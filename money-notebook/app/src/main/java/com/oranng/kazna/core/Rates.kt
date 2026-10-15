package com.oranng.kazna.core

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Official NBU (National Bank of Ukraine) exchange rates. The only network call the
 * app makes: currency code + date go out, one number comes back. No personal data.
 */
object Rates {
    const val HOST = "bank.gov.ua"
    private val compact = DateTimeFormatter.ofPattern("yyyyMMdd")

    fun url(currency: String, date: LocalDate): String =
        "https://$HOST/NBUStatService/v1/statdirectory/exchange?valcode=${currency.uppercase()}&date=${date.format(compact)}&json"

    /** NBU answers `[{"r030":840,"txt":"Долар США","rate":41.2345,"cc":"USD",...}]`, or `[]` for unknown dates. */
    fun parse(json: String): Double? =
        Regex("\"rate\"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)").find(json)?.groupValues?.get(1)?.toDoubleOrNull()?.takeIf { it > 0 }

    fun dateOf(time: Long, zone: ZoneId): LocalDate = Instant.ofEpochMilli(time).atZone(zone).toLocalDate()

    /** Hryvnias for a foreign amount, rounded to kopecks. */
    fun toUah(amount: Double, rate: Double): Double = Math.round(amount * rate * 100) / 100.0
}
