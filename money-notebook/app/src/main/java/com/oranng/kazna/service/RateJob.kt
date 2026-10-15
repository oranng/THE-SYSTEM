package com.oranng.kazna.service

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import com.oranng.kazna.core.Rates
import com.oranng.kazna.data.Db
import java.net.HttpURLConnection
import java.net.URL
import java.time.ZoneId
import kotlin.concurrent.thread

/**
 * Converts foreign-currency spends (Bybit card, USD) into hryvnias at the NBU rate of
 * the purchase date. Scheduled through the system JobScheduler with "needs network":
 * offline, the job simply waits and Android runs it as soon as the phone is online
 * again (also after a reboot). Nothing runs while there is nothing to convert.
 */
class RateJob : JobService() {

    @Volatile private var worker: Thread? = null

    override fun onStartJob(params: JobParameters): Boolean {
        worker = thread(name = "kazna-rates") {
            val ok = runCatching { convertPending(applicationContext) }.getOrDefault(false)
            jobFinished(params, !ok)
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        worker?.interrupt()
        return true // try again later
    }

    companion object {
        private const val JOB_ID = 4201

        /** Ask the system to run the conversion when the network is available. */
        fun schedule(context: Context) {
            val js = context.getSystemService(JobScheduler::class.java) ?: return
            if (js.getPendingJob(JOB_ID) != null) return
            js.schedule(
                JobInfo.Builder(JOB_ID, ComponentName(context, RateJob::class.java))
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPersisted(true)
                    .setBackoffCriteria(30 * 60 * 1000L, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
                    .build(),
            )
        }

        /** Returns true when every pending amount got its rate. */
        fun convertPending(context: Context): Boolean {
            val db = Db.get(context)
            val zone = ZoneId.systemDefault()
            var allDone = true
            for (tx in db.pendingRate()) {
                val date = Rates.dateOf(tx.time, zone)
                val rate = db.cachedRate(tx.currency, date) ?: fetch(tx.currency, date)?.also { db.cacheRate(tx.currency, date, it) }
                if (rate == null) { allDone = false; continue }
                db.update(tx.copy(uah = Rates.toUah(tx.amount, rate)))
            }
            return allDone
        }

        /** NBU has no rate for a date that is not published yet; fall back a few days. */
        private fun fetch(currency: String, date: java.time.LocalDate): Double? {
            for (back in 0L..4L) {
                val body = get(Rates.url(currency, date.minusDays(back))) ?: return null
                Rates.parse(body)?.let { return it }
            }
            return null
        }

        private fun get(url: String): String? = try {
            val c = URL(url).openConnection() as HttpURLConnection
            c.connectTimeout = 15_000
            c.readTimeout = 15_000
            c.setRequestProperty("Accept", "application/json")
            try {
                if (c.responseCode == 200) c.inputStream.bufferedReader().readText() else null
            } finally {
                c.disconnect()
            }
        } catch (e: Exception) {
            null
        }
    }
}
