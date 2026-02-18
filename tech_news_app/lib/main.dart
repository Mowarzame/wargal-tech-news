// File: lib/main.dart
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

    return MaterialApp(
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
      ),
      home: const _AppStartup(),
    );
  }
}

/// ✅ Shows RoleRouter immediately, runs warmup in background.
/// No logo screen, no waiting, no navigation after await.
class _AppStartup extends StatefulWidget {
  const _AppStartup();

  @override
  State<_AppStartup> createState() => _AppStartupState();
}

class _AppStartupState extends State<_AppStartup> with WidgetsBindingObserver {
  bool _started = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _startWarmup() {
    if (_started) return;
    _started = true;

    // ✅ fire-and-forget (no unawaited)
    Future.microtask(() async {
      if (!mounted) return;
      await context.read<UserProvider>().loadUser();
    });

    Future.microtask(() async {
      if (!mounted) return;
      await context.read<NewsProvider>().warmup(); // must read cache first inside warmup
      // optionally start silent refresh inside warmup/provider
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _startWarmup();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // ✅ On resume after long time, trigger a silent refresh (no skeleton)
    if (state == AppLifecycleState.resumed && mounted) {
      Future.microtask(() {
        if (!mounted) return;
        context.read<NewsProvider>().refresh(silent: true);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // ✅ Immediate UI (like Facebook)
    return const RoleRouter();
  }
}
