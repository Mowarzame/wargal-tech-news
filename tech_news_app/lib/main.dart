import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/user_provider.dart';
import 'providers/news_provider.dart';
import 'services/api_service.dart';
import 'screens/role_router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => UserProvider()),
        Provider<ApiService>(create: (_) => ApiService()),
        ChangeNotifierProvider<NewsProvider>(
          create: (context) => NewsProvider(context.read<ApiService>()),
        ),
      ],
      child: const TechNewsApp(),
    ),
  );
}

class TechNewsApp extends StatelessWidget {
  const TechNewsApp({super.key});

  @override
  Widget build(BuildContext context) {
    const primaryBlue = Color(0xFF1565C0);
    const appBg = Color(0xFFF7F8FA);

    return _DismissKeyboard(
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Wargal',
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: primaryBlue,
            brightness: Brightness.light,
          ),
          scaffoldBackgroundColor: appBg,
          appBarTheme: const AppBarTheme(
            centerTitle: false,
            backgroundColor: Colors.white,
            foregroundColor: Colors.black,
            elevation: 0,
            surfaceTintColor: Colors.transparent,
          ),
          cardTheme: CardThemeData(
            elevation: 0,
            color: Colors.white,
            surfaceTintColor: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryBlue,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Colors.grey),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Colors.grey),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: primaryBlue, width: 1.6),
            ),
          ),
          textTheme: const TextTheme(
            titleLarge: TextStyle(fontWeight: FontWeight.w800),
            titleMedium: TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        home: const _BootstrapGate(),
      ),
    );
  }
}

/// ✅ Global: tap anywhere to dismiss keyboard
class _DismissKeyboard extends StatelessWidget {
  final Widget child;
  const _DismissKeyboard({required this.child});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () {
        final focus = FocusManager.instance.primaryFocus;
        if (focus != null) focus.unfocus();
      },
      child: child,
    );
  }
}

class _BootstrapGate extends StatefulWidget {
  const _BootstrapGate();

  @override
  State<_BootstrapGate> createState() => _BootstrapGateState();
}

class _BootstrapGateState extends State<_BootstrapGate> {
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;

      // ✅ Do async startup after first frame
      await Future.wait([
        context.read<UserProvider>().loadUser(),
        context.read<NewsProvider>().warmup(),
      ]);

      if (!mounted) return;

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const RoleRouter()),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Color(0xFF1F5E86),
      body: Center(
        child: _BootLogo(),
      ),
    );
  }
}

class _BootLogo extends StatelessWidget {
  const _BootLogo();

  /// ✅ Your REAL asset path
  static const String logoAssetPath = "assets/icon/wargalIconAndLogo.png";

  @override
  Widget build(BuildContext context) {
    // ✅ No spinner/loading indicator here anymore
    return const SizedBox(
      width: 160,
      height: 160,
      child: _BootLogoImage(),
    );
  }
}

class _BootLogoImage extends StatelessWidget {
  const _BootLogoImage();

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      _BootLogo.logoAssetPath,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => const Icon(
        Icons.radio,
        size: 72,
        color: Colors.white,
      ),
    );
  }
}
