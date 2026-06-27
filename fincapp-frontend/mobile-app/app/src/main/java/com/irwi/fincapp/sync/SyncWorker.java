package com.irwi.fincapp.sync;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.irwi.fincapp.repository.SyncRepository;

public class SyncWorker extends Worker {
    private static final String TAG = "FincAppSync";

    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "SyncWorker started in background.");
        SyncRepository repository = new SyncRepository(getApplicationContext());

        boolean success = repository.dispatchPendingRows();
        if (success) {
            Log.d(TAG, "SyncWorker finished successfully.");
            return Result.success();
        }

        Log.e(TAG, "SyncWorker requested retry.");
        return Result.retry();
    }
}
