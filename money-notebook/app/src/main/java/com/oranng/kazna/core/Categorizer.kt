package com.oranng.kazna.core

object Categories {
    const val GROCERIES = "Продукты"
    const val CAFE = "Кафе и рестораны"
    const val FOOD_DELIVERY = "Доставка еды"
    const val TAXI = "Такси"
    const val TRANSPORT = "Транспорт"
    const val FUEL = "Топливо"
    const val HEALTH = "Здоровье"
    const val SHOPPING = "Покупки"
    const val CLOTHES = "Одежда"
    const val TELECOM = "Связь и интернет"
    const val SUBSCRIPTIONS = "Подписки"
    const val UTILITIES = "Коммуналка"
    const val FUN = "Развлечения"
    const val SPORT = "Спорт"
    const val BEAUTY = "Красота"
    const val POST = "Почта и доставка"
    const val CASH = "Снятие наличных"
    const val FOP = "ФОП и услуги"
    const val PEOPLE = "Переводы людям"
    const val OTHER = "Другое"
    const val INCOME = "Доходы"
    const val OWN = "Между своими"

    /** Spending categories offered in the editor, in display order. */
    val spending = listOf(
        GROCERIES, CAFE, FOOD_DELIVERY, TAXI, TRANSPORT, FUEL, HEALTH, SHOPPING, CLOTHES, TELECOM,
        SUBSCRIPTIONS, UTILITIES, FUN, SPORT, BEAUTY, POST, CASH, FOP, PEOPLE, OTHER,
    )
}

/**
 * Guesses a spending category from the merchant name. The player's own choices
 * (rules learned when they recategorize a merchant) always win over the built-in
 * dictionary of Ukrainian chains and services.
 */
object Categorizer {

    // Ordered: more specific keywords first ("bolt food" before "bolt").
    private val dictionary: List<Pair<String, List<String>>> = listOf(
        Categories.FOOD_DELIVERY to listOf("glovo", "bolt food", "rocket", "raketa", "ракета", "zakaz.ua", "eda.ua"),
        Categories.TAXI to listOf("uklon", "уклон", "bolt", "uber", "ontaxi", "taxi", "таксі", "такси"),
        Categories.FUEL to listOf("wog", "okko", "окко", "socar", "upg", "klo", "brsm", "брсм", "amic", "shell", "avias", "авіас", "укрнафта", "ukrnafta", "азс"),
        Categories.GROCERIES to listOf(
            "silpo", "сільпо", "сильпо", "atb", "атб", "novus", "новус", "varus", "варус", "fora", "фора",
            "metro cash", "auchan", "ашан", "eko market", "еко маркет", "ekomarket", "velmart", "вельмарт",
            "tavria", "таврія", "nash krai", "наш край", "kopiyochka", "копійочка", "spar", "sim23", "сім23",
            "rukavychka", "рукавичка", "blyzenko", "близенько", "trash", "траш", "le silpo", "lotok", "market", "маркет",
            "супермаркет", "продукти", "продукты", "grocery",
        ),
        Categories.CAFE to listOf(
            "mcdonald", "макдональдз", "kfc", "puzata", "пузата", "cafe", "кафе", "coffee", "кава", "кофе",
            "aroma kava", "lviv croissants", "croissant", "pizza", "піца", "пицца", "sushi", "суші", "суши",
            "burger", "бургер", "restaurant", "ресторан", "bar", "бар", "starbucks", "one price", "salateira",
            "domino", "pub", "паб", "bakery", "пекарня",
        ),
        Categories.TRANSPORT to listOf(
            "kyiv metro", "київський метрополітен", "metropoliten", "ukrzaliznytsia", "укрзалізниця", "uz.gov",
            "proizd", "busfor", "flixbus", "parking", "паркінг", "парковка", "kyiv digital", "транспорт", "bus",
        ),
        Categories.HEALTH to listOf(
            "apteka", "аптека", "anc", "анц", "podorozhnyk", "подорожник", "911", "liki", "ліки", "medical",
            "clinic", "клініка", "клиника", "dila", "діла", "synevo", "синево", "стоматолог", "dent", "лікар", "doctor",
        ),
        Categories.CLOTHES to listOf(
            "zara", "h&m", "reserved", "sinsay", "lc waikiki", "colin", "intertop", "answear", "terranova",
            "cropp", "bershka", "pull&bear", "stradivarius", "mohito", "uniqlo", "puma", "nike", "adidas",
        ),
        Categories.SPORT to listOf("sport life", "sportlife", "спорт", "gym", "фітнес", "фитнес", "fitness", "decathlon", "декатлон", "басейн", "бассейн"),
        Categories.SHOPPING to listOf(
            "rozetka", "розетка", "prom.ua", "epicentr", "епіцентр", "эпицентр", "comfy", "foxtrot", "фокстрот",
            "allo", "алло", "moyo", "citrus", "цитрус", "aliexpress", "amazon", "temu", "ikea", "jysk", "eva", "єва",
            "watsons", "prostor", "простор", "makeup", "brocard", "olx", "shafa",
        ),
        Categories.TELECOM to listOf(
            "kyivstar", "київстар", "киевстар", "vodafone", "водафон", "lifecell", "лайфселл", "ukrtelecom",
            "укртелеком", "volia", "воля", "datagroup", "triolan", "тріолан", "інтернет", "internet",
        ),
        Categories.SUBSCRIPTIONS to listOf(
            "netflix", "spotify", "youtube", "google", "apple.com", "itunes", "icloud", "steam", "playstation", "xbox",
            "megogo", "мегого", "sweet.tv", "chatgpt", "openai", "claude", "anthropic", "adobe", "patreon",
            "telegram", "cursor", "github", "notion", "duolingo", "subscription", "підписка", "подписка",
        ),
        Categories.UTILITIES to listOf(
            "yasno", "ясно", "dtek", "дтек", "naftogaz", "нафтогаз", "газ", "водоканал", "теплоенерго",
            "комунал", "коммунал", "осбб", "квартплата", "обленерго", "oblenergo", "kyivteploenergo",
        ),
        Categories.FUN to listOf("кіно", "kino", "multiplex", "мультиплекс", "planeta", "концерт", "concert", "karabas", "карабас", "театр", "theatre", "bowling", "боулінг"),
        Categories.BEAUTY to listOf("барбер", "barber", "salon", "салон", "nail", "манікюр", "маникюр", "cosmetic", "косметик"),
        Categories.POST to listOf("nova poshta", "novaposhta", "нова пошта", "новая почта", "ukrposhta", "укрпошта", "meest"),
        Categories.CASH to listOf("atm", "банкомат", "зняття готівки", "снятие наличных", "cash withdrawal", "видача готівки"),
    )

    private val compiled: List<Pair<String, List<Regex>>> = dictionary.map { (cat, words) ->
        cat to words.map { w ->
            val e = Regex.escape(w)
            // Short tokens must stand alone ("bar" must not hit "barbershop"); long ones may be substrings.
            if (w.length <= 4) Regex("(?i)(?<![\\p{L}\\p{N}])$e(?![\\p{L}\\p{N}])") else Regex("(?i)$e")
        }
    }

    private val fopRe = Regex("(?i)(?<![\\p{L}])(fop|фоп|flp|флп|ip|фізична особа)(?![\\p{L}])")

    /** Normalized merchant key used for learned rules: "SILPO 123 KYIV" → "silpo kyiv". */
    fun merchantKey(merchant: String): String =
        merchant.lowercase()
            .replace(Regex("[^\\p{L}\\s&]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
            .split(' ')
            .take(3)
            .joinToString(" ")

    fun categorize(merchant: String, kind: Kind, transferHint: Boolean, rules: Map<String, String> = emptyMap()): String {
        if (kind == Kind.TRANSFER) return Categories.OWN
        if (kind == Kind.INCOME) return Categories.INCOME
        rules[merchantKey(merchant)]?.let { return it }
        for ((cat, patterns) in compiled) {
            if (patterns.any { it.containsMatchIn(merchant) }) return cat
        }
        if (fopRe.containsMatchIn(merchant)) return Categories.FOP
        if (transferHint) return Categories.PEOPLE
        return Categories.OTHER
    }
}
