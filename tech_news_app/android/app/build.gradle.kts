import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")

if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
}

fun prop(name: String): String? =
    (keystoreProperties[name] as? String)?.trim()?.takeIf { it.isNotEmpty() }

val keyAliasVal = prop("keyAlias")
val keyPasswordVal = prop("keyPassword")
val storeFileVal = prop("storeFile")
val storePasswordVal = prop("storePassword")

val hasReleaseSigning =
    keystorePropertiesFile.exists() &&
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
        create("release") {
            if (!hasReleaseSigning) {
                throw GradleException(
                    """
                    Missing release signing config.
                    Create android/key.properties with:
                      storeFile=<your-upload-keystore-file.jks>
                      storePassword=...
                      keyAlias=...
                      keyPassword=...

                    And place the keystore at:
                      android/app/<storeFile>

                    IMPORTANT:
                    Play expects your AAB to be signed with the Upload key certificate SHA-1:
                      B7:52:F7:02:B0:24:F9:8A:85:D9:12:D9:C3:A6:95:B0:5C:AC:99:A9
                    """.trimIndent()
                )
            }

            keyAlias = keyAliasVal!!
            keyPassword = keyPasswordVal!!
            storeFile = rootProject.file("app/$storeFileVal")
            storePassword = storePasswordVal!!
        }
    }

    buildTypes {
        release {
            // ✅ Always use the upload keystore for release
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            isShrinkResources = false
        }

        debug {
            // default debug signing
        }
    }
}

flutter {
    source = "../.."
}