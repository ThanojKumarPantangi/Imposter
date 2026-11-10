package com.imposter.game

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class AudioRouteModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val audioManager =
        reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var audioFocusRequest: AudioFocusRequest? = null
    private var isVoipSessionActive = false
    private var isReceiverRegistered = false

    private val audioReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action ?: return
            Log.d(TAG, "Audio broadcast received: $action")
            emitRouteChangedEvent()
        }
    }

    override fun getName(): String = "AudioRouteModule"

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    private fun emitRouteChangedEvent() {
        val map = Arguments.createMap()
        map.putString("currentRoute", getCurrentRouteInternal())
        map.putArray("availableRoutes", getAvailableRoutesInternal())
        sendEvent("onAudioRouteChanged", map)
    }

    private fun getCurrentRouteInternal(): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val commDevice = audioManager.communicationDevice
            if (commDevice != null) {
                return when (commDevice.type) {
                    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
                    AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                    AudioDeviceInfo.TYPE_BLE_HEADSET -> "bluetooth"
                    AudioDeviceInfo.TYPE_WIRED_HEADSET,
                    AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "headset"
                    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "earpiece"
                    else -> "unknown"
                }
            }
        }

        if (audioManager.isSpeakerphoneOn) return "speaker"
        if (audioManager.isBluetoothScoOn) return "bluetooth"
        if (audioManager.isWiredHeadsetOn) return "headset"
        return "earpiece"
    }

    private fun getAvailableRoutesInternal(): WritableArray {
        val array = Arguments.createArray()
        val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        val routeSet = mutableSetOf<String>()

        for (device in devices) {
            when (device.type) {
                AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> routeSet.add("speaker")
                AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                AudioDeviceInfo.TYPE_BLE_HEADSET,
                AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> routeSet.add("bluetooth")
                AudioDeviceInfo.TYPE_WIRED_HEADSET,
                AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> routeSet.add("headset")
                AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> routeSet.add("earpiece")
            }
        }

        for (r in routeSet) {
            array.pushString(r)
        }
        return array
    }

    @ReactMethod
    fun startVoipSession(promise: Promise) {
        try {
            if (!isVoipSessionActive) {
                Log.d(TAG, "Starting VoIP audio session (MODE_IN_COMMUNICATION)")
                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                audioManager.isMicrophoneMute = false

                // Request Audio Focus for Speech Communication
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val attributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()

                    audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(attributes)
                        .setAcceptsDelayedFocusGain(true)
                        .setOnAudioFocusChangeListener { focusChange ->
                            Log.d(TAG, "Audio focus changed: $focusChange")
                            if (focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT ||
                                focusChange == AudioManager.AUDIOFOCUS_LOSS) {
                                val map = Arguments.createMap()
                                map.putString("event", "focus_lost")
                                sendEvent("onAudioInterruption", map)
                            } else if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
                                val map = Arguments.createMap()
                                map.putString("event", "focus_gained")
                                sendEvent("onAudioInterruption", map)
                            }
                        }
                        .build()

                    audioFocusRequest?.let { audioManager.requestAudioFocus(it) }
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.requestAudioFocus(
                        null,
                        AudioManager.STREAM_VOICE_CALL,
                        AudioManager.AUDIOFOCUS_GAIN
                    )
                }

                // Register Broadcast Receiver for Headset & Bluetooth state changes
                if (!isReceiverRegistered) {
                    try {
                        val filter = IntentFilter().apply {
                            addAction(Intent.ACTION_HEADSET_PLUG)
                            addAction(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
                            addAction("android.bluetooth.adapter.action.CONNECTION_STATE_CHANGED")
                            addAction("android.bluetooth.headset.profile.action.CONNECTION_STATE_CHANGED")
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            reactContext.registerReceiver(audioReceiver, filter, Context.RECEIVER_EXPORTED)
                        } else {
                            reactContext.registerReceiver(audioReceiver, filter)
                        }
                        isReceiverRegistered = true
                    } catch (e: Exception) {
                        Log.w(TAG, "Could not register audio broadcast receiver: ${e.message}")
                    }
                }

                isVoipSessionActive = true
            }

            promise.resolve(getCurrentRouteInternal())
        } catch (e: Exception) {
            Log.e(TAG, "Error starting VoIP session: ${e.message}", e)
            promise.reject("VOIP_START_ERR", e.message)
        }
    }

    @ReactMethod
    fun stopVoipSession(promise: Promise) {
        try {
            if (isVoipSessionActive) {
                Log.d(TAG, "Stopping VoIP audio session (restoring MODE_NORMAL)")

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    audioManager.clearCommunicationDevice()
                }

                audioManager.isSpeakerphoneOn = false
                audioManager.mode = AudioManager.MODE_NORMAL

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.abandonAudioFocus(null)
                }

                if (isReceiverRegistered) {
                    try {
                        reactContext.unregisterReceiver(audioReceiver)
                    } catch (_: Exception) {}
                    isReceiverRegistered = false
                }

                isVoipSessionActive = false
            }

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping VoIP session: ${e.message}", e)
            promise.reject("VOIP_STOP_ERR", e.message)
        }
    }

    @ReactMethod
    fun setSpeakerphoneOn(enabled: Boolean, promise: Promise) {
        try {
            Log.d(TAG, "setSpeakerphoneOn: $enabled")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (enabled) {
                    val speaker = audioManager.availableCommunicationDevices.find {
                        it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                    }
                    if (speaker != null) {
                        val success = audioManager.setCommunicationDevice(speaker)
                        Log.d(TAG, "setCommunicationDevice(SPEAKER) result: $success")
                    } else {
                        audioManager.clearCommunicationDevice()
                    }
                } else {
                    val privateDevice = audioManager.availableCommunicationDevices.find {
                        it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                        it.type == AudioDeviceInfo.TYPE_BLE_HEADSET ||
                        it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                        it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                        it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
                    }
                    if (privateDevice != null) {
                        val success = audioManager.setCommunicationDevice(privateDevice)
                        Log.d(TAG, "setCommunicationDevice(PRIVATE: ${privateDevice.type}) result: $success")
                    } else {
                        audioManager.clearCommunicationDevice()
                    }
                }
            }

            audioManager.isSpeakerphoneOn = enabled
            emitRouteChangedEvent()
            promise.resolve(getCurrentRouteInternal())
        } catch (e: Exception) {
            Log.e(TAG, "Error in setSpeakerphoneOn: ${e.message}", e)
            promise.reject("SPEAKER_ROUTE_ERR", e.message)
        }
    }

    @ReactMethod
    fun getCurrentRoute(promise: Promise) {
        try {
            promise.resolve(getCurrentRouteInternal())
        } catch (e: Exception) {
            promise.reject("ROUTE_ERR", e.message)
        }
    }

    @ReactMethod
    fun getAvailableRoutes(promise: Promise) {
        try {
            promise.resolve(getAvailableRoutesInternal())
        } catch (e: Exception) {
            promise.reject("AVAILABLE_ROUTES_ERR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for React Native NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for React Native NativeEventEmitter
    }

    companion object {
        private const val TAG = "AudioRouteModule"
    }
}

