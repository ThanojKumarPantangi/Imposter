package com.imposter.game

import androidx.appcompat.app.AppCompatActivity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

class CrashActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val errorText = intent.getStringExtra("error") ?: "Unknown error"

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.parseColor("#07090e"))
      setPadding(40, 60, 40, 40)
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }

    val title = TextView(this).apply {
      text = "App Startup Error"
      setTextColor(Color.parseColor("#f43f5e"))
      textSize = 20f
      typeface = Typeface.DEFAULT_BOLD
      setPadding(0, 0, 0, 16)
    }
    root.addView(title)

    val subtitle = TextView(this).apply {
      text = "The application encountered a fatal error during startup:"
      setTextColor(Color.parseColor("#94a3b8"))
      textSize = 13f
      setPadding(0, 0, 0, 24)
    }
    root.addView(subtitle)

    val btnRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      layoutParams = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
      ).apply {
        setMargins(0, 0, 0, 24)
      }
    }

    val copyBtn = Button(this).apply {
      text = "Copy Error"
      setBackgroundColor(Color.parseColor("#f43f5e"))
      setTextColor(Color.WHITE)
      setOnClickListener {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("Crash Error", errorText)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(this@CrashActivity, "Error copied to clipboard!", Toast.LENGTH_SHORT).show()
      }
      layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
        setMargins(0, 0, 12, 0)
      }
    }
    btnRow.addView(copyBtn)

    val restartBtn = Button(this).apply {
      text = "Restart App"
      setBackgroundColor(Color.parseColor("#1e293b"))
      setTextColor(Color.WHITE)
      setOnClickListener {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        if (launchIntent != null) {
          launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
          startActivity(launchIntent)
        }
        finish()
      }
      layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
        setMargins(12, 0, 0, 0)
      }
    }
    btnRow.addView(restartBtn)
    root.addView(btnRow)

    val scrollView = ScrollView(this).apply {
      layoutParams = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      setBackgroundColor(Color.parseColor("#0d1117"))
      setPadding(24, 24, 24, 24)
    }

    val errorView = TextView(this).apply {
      text = errorText
      setTextColor(Color.parseColor("#f1f5f9"))
      textSize = 11f
      typeface = Typeface.MONOSPACE
      setTextIsSelectable(true)
    }
    scrollView.addView(errorView)
    root.addView(scrollView)

    setContentView(root)
  }
}

