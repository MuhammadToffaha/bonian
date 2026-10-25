package com.toffaha.bonian

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.speech.RecognizerIntent
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
import java.io.File
import java.util.Calendar
import java.util.concurrent.Executors

/** 🏢 بُنيان — building fees & expenses manager. UI = assets/www (HTML/JS), this class = native bridge "Bn". */
class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private val io = Executors.newSingleThreadExecutor()

    companion object { @Volatile var instance: MainActivity? = null }

    private val speech = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val text = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (text != null) js("App.onSpeech(${JSONObject.quote(text)})") else js("App.onSpeechErr('')")
    }
    private val picker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@registerForActivityResult
        io.execute {
            val text = runCatching { contentResolver.openInputStream(uri)!!.bufferedReader().use { it.readText() } }.getOrDefault("")
            js("App.onImport(${JSONObject.quote(text)})")
        }
    }
    private val notifPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this
        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#F4F7FE")) }
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.textZoom = 100
            setBackgroundColor(Color.TRANSPARENT)
            addJavascriptInterface(Bridge(), "Bn")
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
                    val u = req.url
                    if (u.scheme == "file") return false
                    openIntent(Intent(Intent.ACTION_VIEW, u)); return true
                }
            }
        }
        root.addView(web)
        setContentView(root)
        // Android 15 draws edge-to-edge: keep the page out of the status / nav bars.
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, ins ->
            val b = ins.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(b.left, b.top, b.right, b.bottom); WindowInsetsCompat.CONSUMED
        }
        web.loadUrl("file:///android_asset/www/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("App.back()") { r -> if (r != "true") finish() }
            }
        })

        // first run: don't fire the "new month" notification immediately
        val c = Calendar.getInstance()
        if (Prefs.get(this, "remind", "").isEmpty()) Prefs.set(this, "remind", "${c.get(Calendar.YEAR)}-${c.get(Calendar.MONTH) + 1}")
        if (Build.VERSION.SDK_INT >= 33) notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
        UpdateWorker.schedule(this)
    }

    override fun onResume() { super.onResume(); Prefs.inForeground = true }
    override fun onPause() { super.onPause(); Prefs.inForeground = false }

    // 🔒 away from the app for more than a minute (not just a quick WhatsApp / mic / file trip) → lock admin mode
    private var stoppedAt = 0L
    override fun onStop() { super.onStop(); stoppedAt = System.currentTimeMillis() }
    override fun onStart() {
        super.onStart()
        if (stoppedAt > 0 && System.currentTimeMillis() - stoppedAt > 60_000) js("window.App&&App.lock()")
        stoppedAt = 0
    }
    override fun onDestroy() { if (instance === this) instance = null; super.onDestroy() }

    fun js(code: String) = runOnUiThread { runCatching { web.evaluateJavascript(code, null) } }
    fun installMsg(m: String) = js("App.onInstallMsg(${JSONObject.quote(m)})")

    private fun openIntent(i: Intent) = runOnUiThread {
        try { startActivity(i) } catch (e: ActivityNotFoundException) { Toast.makeText(this, "⚠️ مفيش تطبيق يفتح ده", Toast.LENGTH_SHORT).show() }
    }

    private val dataFile get() = File(filesDir, "data.json")

    inner class Bridge {
        @JavascriptInterface fun load(): String = runCatching { dataFile.readText() }.getOrDefault("")

        /** atomic write + one rolling safety copy per day */
        @JavascriptInterface fun save(json: String) {
            synchronized(this) {
                val tmp = File(filesDir, "data.tmp")
                tmp.writeText(json)
                val day = File(filesDir, "data-" + android.text.format.DateFormat.format("yyyyMMdd", System.currentTimeMillis()) + ".bak")
                if (dataFile.exists() && !day.exists()) {
                    dataFile.copyTo(day, overwrite = true)
                    filesDir.listFiles { f -> f.name.endsWith(".bak") }?.sortedBy { it.name }?.dropLast(7)?.forEach { it.delete() }
                }
                if (!tmp.renameTo(dataFile)) { dataFile.writeText(json); tmp.delete() }
            }
        }

        /** 🔐 SHA-256 of the admin password (only the hash is stored) */
        @JavascriptInterface fun hash(s: String): String =
            java.security.MessageDigest.getInstance("SHA-256").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

        @JavascriptInterface fun version(): String = BuildConfig.VERSION_NAME
        @JavascriptInterface fun versionCode(): Int = BuildConfig.VERSION_CODE
        @JavascriptInterface fun getPref(k: String, d: String): String = Prefs.get(this@MainActivity, k, d)
        @JavascriptInterface fun setPref(k: String, v: String) = Prefs.set(this@MainActivity, k, v)
        @JavascriptInterface fun theme(dark: Boolean) = runOnUiThread {
            val c = Color.parseColor(if (dark) "#0F1626" else "#F4F7FE")
            (web.parent as FrameLayout).setBackgroundColor(c)
            @Suppress("DEPRECATION") run { window.statusBarColor = c; window.navigationBarColor = c }
            androidx.core.view.WindowCompat.getInsetsController(window, web).isAppearanceLightStatusBars = !dark
        }

        @JavascriptInterface fun checkUpdate() = io.execute {
            val r = runCatching { Updater.latest() }.getOrNull()
            js("App.onUpdate(${JSONObject.quote(r?.json() ?: "")})")
        }

        @JavascriptInterface fun installUpdate(url: String) = io.execute {
            val ctx = this@MainActivity
            if (!Updater.canInstall(ctx)) {
                installMsg("🔐 فعّل \"تثبيت التطبيقات\" لبُنيان وارجع اضغط حدّث"); Updater.askInstallPermission(ctx); return@execute
            }
            try {
                var last = -1
                val f = Updater.download(ctx, url) { p -> val pc = (p * 100).toInt(); if (pc != last) { last = pc; js("App.onProgress($p)") } }
                installMsg("📦 بيتثبت…")
                Updater.install(ctx, f)
            } catch (e: Exception) { installMsg("⚠️ فشل التحميل: ${e.message}") }
        }

        @JavascriptInterface fun listen() = runOnUiThread {
            val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-EG")
                .putExtra(RecognizerIntent.EXTRA_PROMPT, "🎤 قول مثلاً: حصلت 300 من شقة 5")
            try { speech.launch(i) } catch (e: ActivityNotFoundException) { js("App.onSpeechErr('مفيش خدمة تعرّف صوت على الموبايل — اكتب بدالها')") }
        }

        @JavascriptInterface fun share(text: String) =
            openIntent(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "مشاركة"))

        @JavascriptInterface fun whatsapp(phone: String, text: String) {
            val u = Uri.parse("https://wa.me/$phone" + if (text.isNotEmpty()) "?text=" + Uri.encode(text) else "")
            openIntent(Intent(Intent.ACTION_VIEW, u))
        }

        @JavascriptInterface fun call(phone: String) = openIntent(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(phone))))
        @JavascriptInterface fun openUrl(url: String) = openIntent(Intent(Intent.ACTION_VIEW, Uri.parse(url)))

        @JavascriptInterface fun shareFile(name: String, content: String, mime: String) {
            val dir = File(cacheDir, "share").apply { mkdirs() }
            val safe = name.replace(Regex("[\\\\/:*?\"<>|]"), "_")
            val f = File(dir, safe).apply { writeText(content) }
            val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", f)
            openIntent(Intent.createChooser(Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), "حفظ / مشاركة"))
        }

        @JavascriptInterface fun importBackup() = runOnUiThread { picker.launch("*/*") }
    }
}
