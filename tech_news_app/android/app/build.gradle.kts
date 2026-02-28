import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasKeystoreFile = keystorePropertiesFile.exists()

if (hasKeystoreFile) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
}

fun prop(name: String): String? =
    (keystoreProperties[name] as? String)?.trim()?.takeIf { it.isNotEmpty() }

val keyAliasVal = prop("keyAlias")
val keyPasswordVal = prop("keyPassword")
val storeFileVal = prop("storeFile")
val storePasswordVal = prop("storePassword")

val hasReleaseSigning =
    hasKeystoreFile &&
        keyAliasVal != null &&
        keyPasswordVal != null &&
        storeFileVal != null &&
        storePasswordVal != null

android {
    namespace = "com.wargalstudio.wargalnews"

    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.wargalstudio.wargalnews"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        // Always exists (Gradle creates debug automatically, but we keep release conditional)
        create("release") {
            if (hasReleaseSigning) {
                keyAlias = keyAliasVal!!
                keyPassword = keyPasswordVal!!
                storeFile = rootProject.file("app/$storeFileVal")
                storePassword = storePasswordVal!!
            }
        }
    }

    buildTypes {
        release {
            // ✅ If no keystore on this machine, use debug signing so local --release works
            signingConfig = if (hasReleaseSigning) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }

            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

flutter {
    source = "../.."
}