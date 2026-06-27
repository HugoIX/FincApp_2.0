package com.irwi.fincapp.sync;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class NetworkChangeReceiver extends BroadcastReceiver {
    private static final String TAG = "FincAppSync";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Network broadcast received. Scheduling constrained WorkManager sync.");
        SyncScheduler.scheduleOneTimeSync(context.getApplicationContext());
    }
}
