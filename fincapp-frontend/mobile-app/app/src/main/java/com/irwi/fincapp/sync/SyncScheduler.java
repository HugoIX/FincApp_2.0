package com.irwi.fincapp.sync;
import android.content.Context;import androidx.work.*;import java.util.concurrent.TimeUnit;
public class SyncScheduler{ public static void schedule(Context c){Constraints con=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(); OneTimeWorkRequest r=new OneTimeWorkRequest.Builder(SyncWorker.class).setConstraints(con).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build(); WorkManager.getInstance(c).enqueueUniqueWork("fincapp-sync",ExistingWorkPolicy.KEEP,r);} }
