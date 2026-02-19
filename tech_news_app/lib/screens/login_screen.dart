import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/auth_service.dart';
import 'role_router.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final AuthService _authService = AuthService();

  bool _loading = false;
  String? _error;

  // ✅ Your REAL public links (GitHub Pages)
  static const String _termsUrl = "https://mowarzame.github.io/wargal-repository/terms";
  static const String _privacyUrl = "https://mowarzame.github.io/wargal-repository/privacy";

  Future<void> _openExternal(String url) async {
    try {
      final uri = Uri.parse(url);

      // ✅ Avoid throwing on some devices
      final can = await canLaunchUrl(uri);
      if (!can) return;

      await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      // keep UI unchanged (silent fail)
    }
  }

  Future<void> _loginWithGoogle() async {
    if (_loading) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final user = await _authService.loginWithGoogle();
      if (!mounted) return;

      if (user != null) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const RoleRouter()),
        );
      } else {
        setState(() => _error = "Login failed. Please try again.");
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = "Something went wrong. $e");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;

    const white = Colors.white;
    const white70 = Colors.white70;

    return Scaffold(
      backgroundColor: primary,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo
                  Image.asset(
                    'assets/icon/wargalIconAndLogo.png',
                    width: 220,
                    height: 220,
                    fit: BoxFit.contain,
                  ),

                  const SizedBox(height: 18),

                  // Glass card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: Column(
                      children: [
                        if (_error != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.14),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.white24),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.info_outline,
                                  color: white70,
                                  size: 20,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    _error!,
                                    style: const TextStyle(
                                      color: white,
                                      height: 1.3,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                        ],

                        // Google button only
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: OutlinedButton(
                            onPressed: _loading ? null : _loginWithGoogle,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: white,
                              side: const BorderSide(color: Colors.white70),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: _loading
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.4,
                                      color: white,
                                    ),
                                  )
                                : Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Container(
                                        width: 22,
                                        height: 22,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: const Text(
                                          "G",
                                          style: TextStyle(
                                            fontWeight: FontWeight.w900,
                                            fontSize: 14,
                                            color: Colors.black,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      const Text(
                                        "Continue with Google",
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 15,
                                        ),
                                      ),
                                    ],
                                  ),
                          ),
                        ),

                        const SizedBox(height: 12),

                        // ✅ Same placement as before, now clickable
                        RichText(
                          textAlign: TextAlign.center,
                          text: TextSpan(
                            style: const TextStyle(
                              color: white70,
                              height: 1.35,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                            children: [
                              const TextSpan(text: "By continuing you agree to our "),
                              TextSpan(
                                text: "Terms",
                                style: const TextStyle(
                                  decoration: TextDecoration.underline,
                                  color: white,
                                ),
                                recognizer: TapGestureRecognizer()
                                  ..onTap = () => _openExternal(_termsUrl),
                              ),
                              const TextSpan(text: " and "),
                              TextSpan(
                                text: "Privacy Policy",
                                style: const TextStyle(
                                  decoration: TextDecoration.underline,
                                  color: white,
                                ),
                                recognizer: TapGestureRecognizer()
                                  ..onTap = () => _openExternal(_privacyUrl),
                              ),
                              const TextSpan(text: "."),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  const Text(
                    "Tip: Use the same Google account on Android & iOS for consistent roles (Admin/Editor/User).",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: white70,
                      fontSize: 12.5,
                      height: 1.35,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
