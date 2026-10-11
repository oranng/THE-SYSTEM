plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.oranng.kazna"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.oranng.kazna"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "1.1.0"
    }

    // Permanent signing key: the phone only accepts updates signed with the same key.
    // The key file is private (never committed): put it at money-notebook/keystore/kazna.jks
    // or point KAZNA_KEYSTORE at it. Without it the build falls back to the local debug key,
    // which will NOT update an installed Казна.
    val keystoreFile = (System.getenv("KAZNA_KEYSTORE") ?: rootProject.file("keystore/kazna.jks").path).let(::file)
    signingConfigs {
        create("kazna") {
            storeFile = keystoreFile
            storePassword = (findProperty("kaznaStorePassword") as String?) ?: "android"
            keyAlias = (findProperty("kaznaKeyAlias") as String?) ?: "androiddebugkey"
            keyPassword = (findProperty("kaznaKeyPassword") as String?) ?: "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (keystoreFile.exists()) signingConfigs.getByName("kazna") else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    testImplementation("junit:junit:4.13.2")
}
