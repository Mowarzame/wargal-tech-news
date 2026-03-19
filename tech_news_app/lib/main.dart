import 'dart:io' show Platform;

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'providers/user_provider.dart';
import 'providers/news_provider.dart';
import 'services/api_service.dart';
import 'screens/role_router.dart';

final FirebaseAnalytics firebaseAnalytics = FirebaseAnalytics.instance;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (Platform.isAndroid) {
    await Firebase.initializeApp();
  }

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => UserProvider()),
        Provider<ApiService>(create: (_) => ApiService()),
        ChangeNotifierProvider<NewsProvider>(
          create: (context) => NewsProvider(context.read<ApiService>()),
        ),
        if (Platform.isAndroid)
          Provider<FirebaseAnalytics>.value(value: firebaseAnalytics),
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
      navigatorObservers: Platform.isAndroid
          ? [FirebaseAnalyticsObserver(analytics: firebaseAnalytics)]
          : [],
      home: const _AppStartup(),
    );
  }
}

class _AppStartup extends StatefulWidget {
  const _AppStartup();

  @override
  State<_AppStartup> createState() => _AppStartupState();
}

class _AppStartupState extends State<_AppStartup>
    with WidgetsBindingObserver {
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

    Future.microtask(() async {
      if (!mounted) return;
      await context.read<UserProvider>().loadUser();
    });

    Future.microtask(() async {
      if (!mounted) return;
      await context.read<NewsProvider>().warmup();
    });

    if (Platform.isAndroid) {
      Future.microtask(() async {
        await firebaseAnalytics.logAppOpen();
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _startWarmup();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      Future.microtask(() {
        if (!mounted) return;
        context.read<NewsProvider>().refreshOnResume();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return const RoleRouter();
  }
}