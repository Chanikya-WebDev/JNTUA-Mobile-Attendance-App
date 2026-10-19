import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val localProperties = Properties().apply {
    val localPropsFile = rootProject.file("local.properties")
    if (localPropsFile.exists()) {
        localPropsFile.inputStream().use { stream -> load(stream) }
    }
}

val keystorePath: String = System.getenv("KEYSTORE_FILE")
    ?: localProperties.getProperty("keystore.file")
    ?: "release.keystore"
val keystorePassword: String? = System.getenv("KEYSTORE_PASSWORD")
    ?: localProperties.getProperty("keystore.password")
val keyAliasName: String? = System.getenv("KEY_ALIAS")
    ?: localProperties.getProperty("key.alias")
val keyPasswordVal: String? = System.getenv("KEY_PASSWORD")
    ?: localProperties.getProperty("key.password")

android {
    namespace = "com.chanikya501.jntuaattendance"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.chanikya501.JNTUAAttendance"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        resourceConfigurations += setOf("en") // Strips 80+ unused locale strings

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        create("release") {
            val keyFile = file(keystorePath)
            if (keyFile.exists() && !keystorePassword.isNullOrBlank() && !keyAliasName.isNullOrBlank() && !keyPasswordVal.isNullOrBlank()) {
                storeFile = keyFile
                storePassword = keystorePassword
                keyAlias = keyAliasName
                keyPassword = keyPasswordVal
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = false
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val releaseSigning = signingConfigs.getByName("release")
            if (releaseSigning.storeFile != null) {
                signingConfig = releaseSigning
            }
        }
        debug {
            isMinifyEnabled = false
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

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.10"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20231013")
}
