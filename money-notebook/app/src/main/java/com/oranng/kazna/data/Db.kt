package com.oranng.kazna.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.oranng.kazna.core.Categorizer
import com.oranng.kazna.core.Kind
import com.oranng.kazna.core.Origin
import com.oranng.kazna.core.Tx
import com.oranng.kazna.core.TxStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** A notification from a watched app, kept so formats can be checked and fixed. */
data class LogEntry(
    val id: Long,
    val time: Long,
    val packageName: String,
    val appLabel: String,
    val title: String,
    val text: String,
    val result: String,
)

/** An app that has posted notifications, with the player's watch choice. */
data class SeenApp(val packageName: String, val label: String, val watched: Boolean, val lastSeen: Long)

/** Local SQLite storage. Nothing ever leaves the phone. */
class Db private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "kazna.db", null, 1), TxStore {

    companion object {
        @Volatile private var instance: Db? = null
        fun get(context: Context): Db =
            instance ?: synchronized(this) { instance ?: Db(context).also { instance = it } }

        private val _version = MutableStateFlow(0)
        /** Bumped on every write so open screens refresh. */
        val version: StateFlow<Int> = _version
        fun changed() { _version.value = _version.value + 1 }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE tx (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                time INTEGER NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL,
                direction INTEGER NOT NULL,
                kind TEXT NOT NULL,
                merchant TEXT NOT NULL,
                category TEXT NOT NULL,
                source TEXT NOT NULL,
                account TEXT,
                balance REAL,
                origin TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                fingerprint TEXT NOT NULL DEFAULT '',
                transfer_hint INTEGER NOT NULL DEFAULT 0,
                purchase_hint INTEGER NOT NULL DEFAULT 0,
                review INTEGER NOT NULL DEFAULT 0
            )""",
        )
        db.execSQL("CREATE INDEX tx_time ON tx(time)")
        db.execSQL("CREATE TABLE rule (merchant_key TEXT PRIMARY KEY, category TEXT NOT NULL)")
        db.execSQL(
            """CREATE TABLE log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                time INTEGER NOT NULL,
                package TEXT NOT NULL,
                label TEXT NOT NULL,
                title TEXT NOT NULL,
                text TEXT NOT NULL,
                result TEXT NOT NULL
            )""",
        )
        db.execSQL("CREATE TABLE app (package TEXT PRIMARY KEY, label TEXT NOT NULL, watched INTEGER NOT NULL, last_seen INTEGER NOT NULL)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    // ── TxStore ──────────────────────────────────────────────────────────────

    override fun inRange(from: Long, to: Long): List<Tx> =
        query("SELECT * FROM tx WHERE time BETWEEN ? AND ? ORDER BY time DESC", from, to)

    override fun hasFingerprint(fingerprint: String): Boolean =
        readableDatabase.rawQuery(
            "SELECT 1 FROM tx WHERE fingerprint = ? OR fingerprint LIKE ? OR fingerprint LIKE ? LIMIT 1",
            arrayOf(fingerprint, "$fingerprint|%", "%|$fingerprint"),
        ).use { it.moveToFirst() }

    override fun insert(tx: Tx): Long = writableDatabase.insert("tx", null, values(tx)).also { changed() }

    override fun update(tx: Tx) {
        writableDatabase.update("tx", values(tx), "id = ?", arrayOf(tx.id.toString()))
        changed()
    }

    override fun delete(id: Long) {
        writableDatabase.delete("tx", "id = ?", arrayOf(id.toString()))
        changed()
    }

    override fun lastWithBalance(source: String, account: String?, currency: String, before: Long): Tx? =
        query(
            "SELECT * FROM tx WHERE balance IS NOT NULL AND source = ? AND IFNULL(account,'') = ? AND currency = ? AND time < ? ORDER BY time DESC LIMIT 1",
            source, account ?: "", currency, before,
        ).firstOrNull()

    override fun newestWithBalance(source: String, account: String?, currency: String): Tx? =
        query(
            "SELECT * FROM tx WHERE balance IS NOT NULL AND source = ? AND IFNULL(account,'') = ? AND currency = ? ORDER BY time DESC LIMIT 1",
            source, account ?: "", currency,
        ).firstOrNull()

    override fun rules(): Map<String, String> =
        readableDatabase.rawQuery("SELECT merchant_key, category FROM rule", null).use { c ->
            buildMap { while (c.moveToNext()) put(c.getString(0), c.getString(1)) }
        }

    // ── App-level queries ────────────────────────────────────────────────────

    fun all(): List<Tx> = query("SELECT * FROM tx ORDER BY time DESC")

    fun countReview(): Int =
        readableDatabase.rawQuery("SELECT COUNT(*) FROM tx WHERE review = 1", null).use { it.moveToFirst(); it.getInt(0) }

    /** Remember a category for a merchant and apply it to every past transaction there. */
    fun learnRule(merchant: String, category: String) {
        val key = Categorizer.merchantKey(merchant)
        if (key.isBlank()) return
        writableDatabase.insertWithOnConflict(
            "rule", null,
            ContentValues().apply { put("merchant_key", key); put("category", category) },
            SQLiteDatabase.CONFLICT_REPLACE,
        )
        for (tx in all()) {
            if (tx.kind == Kind.SPEND && Categorizer.merchantKey(tx.merchant) == key && tx.category != category) {
                writableDatabase.update("tx", values(tx.copy(category = category, review = false)), "id = ?", arrayOf(tx.id.toString()))
            }
        }
        changed()
    }

    fun log(time: Long, pkg: String, label: String, title: String, text: String, result: String) {
        val db = writableDatabase
        db.insert("log", null, ContentValues().apply {
            put("time", time); put("package", pkg); put("label", label)
            put("title", title); put("text", text); put("result", result)
        })
        db.execSQL("DELETE FROM log WHERE id NOT IN (SELECT id FROM log ORDER BY id DESC LIMIT 300)")
        changed()
    }

    fun logEntries(): List<LogEntry> =
        readableDatabase.rawQuery("SELECT * FROM log ORDER BY id DESC LIMIT 150", null).use { c ->
            buildList {
                while (c.moveToNext()) add(
                    LogEntry(
                        c.getLong(c.getColumnIndexOrThrow("id")), c.getLong(c.getColumnIndexOrThrow("time")),
                        c.str("package"), c.str("label"), c.str("title"), c.str("text"), c.str("result"),
                    ),
                )
            }
        }

    /** Records that an app posted a notification; returns whether it is watched. */
    fun seeApp(pkg: String, label: String, defaultWatched: Boolean, time: Long): Boolean {
        val db = writableDatabase
        val existing = db.rawQuery("SELECT watched, label FROM app WHERE package = ?", arrayOf(pkg)).use { c ->
            if (c.moveToFirst()) (c.getInt(0) == 1) to c.getString(1) else null
        }
        if (existing == null) {
            db.insert("app", null, ContentValues().apply {
                put("package", pkg); put("label", label); put("watched", if (defaultWatched) 1 else 0); put("last_seen", time)
            })
            return defaultWatched
        }
        db.execSQL("UPDATE app SET last_seen = ?, label = ? WHERE package = ?", arrayOf<Any>(time, label, pkg))
        return existing.first
    }

    fun apps(): List<SeenApp> =
        readableDatabase.rawQuery("SELECT * FROM app ORDER BY watched DESC, last_seen DESC", null).use { c ->
            buildList {
                while (c.moveToNext()) add(SeenApp(c.str("package"), c.str("label"), c.getInt(c.getColumnIndexOrThrow("watched")) == 1, c.getLong(c.getColumnIndexOrThrow("last_seen"))))
            }
        }

    fun setWatched(pkg: String, watched: Boolean) {
        writableDatabase.execSQL("UPDATE app SET watched = ? WHERE package = ?", arrayOf<Any>(if (watched) 1 else 0, pkg))
        changed()
    }

    fun wipe() {
        writableDatabase.execSQL("DELETE FROM tx")
        writableDatabase.execSQL("DELETE FROM log")
        writableDatabase.execSQL("DELETE FROM rule")
        changed()
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    private fun query(sql: String, vararg args: Any): List<Tx> =
        readableDatabase.rawQuery(sql, args.map { it.toString() }.toTypedArray()).use { c ->
            buildList { while (c.moveToNext()) add(read(c)) }
        }

    private fun Cursor.str(col: String): String = getString(getColumnIndexOrThrow(col)) ?: ""

    private fun read(c: Cursor): Tx {
        fun idx(n: String) = c.getColumnIndexOrThrow(n)
        return Tx(
            id = c.getLong(idx("id")),
            time = c.getLong(idx("time")),
            amount = c.getDouble(idx("amount")),
            currency = c.str("currency"),
            direction = c.getInt(idx("direction")),
            kind = Kind.valueOf(c.str("kind")),
            merchant = c.str("merchant"),
            category = c.str("category"),
            source = c.str("source"),
            account = if (c.isNull(idx("account"))) null else c.getString(idx("account")),
            balance = if (c.isNull(idx("balance"))) null else c.getDouble(idx("balance")),
            origin = Origin.valueOf(c.str("origin")),
            note = c.str("note"),
            fingerprint = c.str("fingerprint"),
            transferHint = c.getInt(idx("transfer_hint")) == 1,
            purchaseHint = c.getInt(idx("purchase_hint")) == 1,
            review = c.getInt(idx("review")) == 1,
        )
    }

    private fun values(tx: Tx) = ContentValues().apply {
        put("time", tx.time); put("amount", tx.amount); put("currency", tx.currency)
        put("direction", tx.direction); put("kind", tx.kind.name); put("merchant", tx.merchant)
        put("category", tx.category); put("source", tx.source)
        if (tx.account == null) putNull("account") else put("account", tx.account)
        if (tx.balance == null) putNull("balance") else put("balance", tx.balance)
        put("origin", tx.origin.name); put("note", tx.note); put("fingerprint", tx.fingerprint)
        put("transfer_hint", if (tx.transferHint) 1 else 0); put("purchase_hint", if (tx.purchaseHint) 1 else 0)
        put("review", if (tx.review) 1 else 0)
    }
}
