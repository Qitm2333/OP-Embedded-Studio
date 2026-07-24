package app.openpencil.bleuploader;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

public final class CameraFileProvider extends ContentProvider {
    private static final String CAPTURE_FILE_NAME = "openpencil-camera.jpg";

    static File captureFile(Context context) {
        return new File(context.getCacheDir(), CAPTURE_FILE_NAME);
    }

    static Uri captureUri(Context context) {
        return Uri.parse("content://" + context.getPackageName() + ".camera/" + CAPTURE_FILE_NAME);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public String getType(Uri uri) {
        return "image/jpeg";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        Context context = getContext();
        if (context == null || !CAPTURE_FILE_NAME.equals(uri.getLastPathSegment())) {
            throw new FileNotFoundException("Unknown camera capture URI");
        }
        int flags = mode.contains("w")
                ? ParcelFileDescriptor.MODE_CREATE
                    | ParcelFileDescriptor.MODE_TRUNCATE
                    | ParcelFileDescriptor.MODE_READ_WRITE
                : ParcelFileDescriptor.MODE_READ_ONLY;
        return ParcelFileDescriptor.open(captureFile(context), flags);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        String[] columns = projection == null
                ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}
                : projection;
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        MatrixCursor.RowBuilder row = cursor.newRow();
        Context context = getContext();
        File file = context == null ? null : captureFile(context);
        for (String column : columns) {
            if (OpenableColumns.DISPLAY_NAME.equals(column)) row.add(CAPTURE_FILE_NAME);
            else if (OpenableColumns.SIZE.equals(column)) row.add(file == null ? 0 : file.length());
            else row.add(null);
        }
        return cursor;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        Context context = getContext();
        return context != null && captureFile(context).delete() ? 1 : 0;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException();
    }
}
