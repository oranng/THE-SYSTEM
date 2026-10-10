package com.oranng.kazna.core

import org.junit.Assert.assertEquals
import org.junit.Test

class CategorizerTest {
    private fun cat(m: String, hint: Boolean = false) = Categorizer.categorize(m, Kind.SPEND, hint)

    @Test fun ukrainianChains() {
        assertEquals(Categories.GROCERIES, cat("SILPO KYIV"))
        assertEquals(Categories.GROCERIES, cat("ATB-MARKET 1234"))
        assertEquals(Categories.GROCERIES, cat("Сільпо"))
        assertEquals(Categories.FUEL, cat("WOG 15"))
        assertEquals(Categories.FUEL, cat("OKKO AZK 21"))
        assertEquals(Categories.FOOD_DELIVERY, cat("Bolt Food"))
        assertEquals(Categories.TAXI, cat("BOLT.EU"))
        assertEquals(Categories.TAXI, cat("Uklon"))
        assertEquals(Categories.HEALTH, cat("APTEKA ANC"))
        assertEquals(Categories.SHOPPING, cat("ROZETKA.UA"))
        assertEquals(Categories.SUBSCRIPTIONS, cat("NETFLIX.COM"))
        assertEquals(Categories.TELECOM, cat("KYIVSTAR"))
        assertEquals(Categories.POST, cat("NOVA POSHTA"))
        assertEquals(Categories.CAFE, cat("Aroma Kava"))
    }

    @Test fun shortTokensNeedWordBoundaries() {
        assertEquals(Categories.BEAUTY, cat("BARBERSHOP CHE"))
        assertEquals(Categories.CAFE, cat("LOFT BAR"))
    }

    @Test fun fopAndPeople() {
        assertEquals(Categories.FOP, cat("FOP Ivanenko I.I."))
        assertEquals(Categories.FOP, cat("ФОП Петренко"))
        assertEquals(Categories.PEOPLE, cat("Олена К.", hint = true))
        assertEquals(Categories.OTHER, cat("ZXCV 123"))
    }

    @Test fun kindsOverrideMerchant() {
        assertEquals(Categories.OWN, Categorizer.categorize("SILPO", Kind.TRANSFER, false))
        assertEquals(Categories.INCOME, Categorizer.categorize("SILPO", Kind.INCOME, false))
    }

    @Test fun merchantKeyIgnoresNumbers() {
        assertEquals("silpo kyiv", Categorizer.merchantKey("SILPO 123 KYIV"))
        assertEquals(Categorizer.merchantKey("WOG 15"), Categorizer.merchantKey("WOG 22"))
    }
}
