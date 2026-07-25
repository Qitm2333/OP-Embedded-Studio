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
    private static final String IMPORT_FILE_PREFIX = "openpencil-import-";

    static File captureFile(Context context) {
        return new File(context.getCacheDir(), CAPTURE_FILE_NAME);
    }

    static Uri captureUri(Context context) {
        return fileUri(context, captureFile(context));
    }

    static File importFile(Context context, String batchId, int index) {
        return new File(context.getCacheDir(), IMPORT_FILE_PREFIX + batchId + "-" + index + ".png");
    }

    static Uri importUri(Context context, String batchId, int index) {
        return fileUri(context, importFile(context, batchId, index));
    }

    static void clearImportedFiles(Context context) {
        File[] files = context.getCacheDir().listFiles(
                file -> file.getName().startsWith(IMPORT_FILE_PREFIX));
        if (files == null) return;
        for (File file : files) file.delete();
    }

    private static Uri fileUri(Context context, File file) {
        return Uri.parse("content://" + context.getPackageName() + ".camera/" + file.getName());
    }

    private static File resolveFile(Context context, Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (CAPTURE_FILE_NAME.equals(name)) return captureFile(context);
        if (name != null
                && name.startsWith(IMPORT_FILE_PREFIX)
                && name.endsWith(".png")
                && name.indexOf('/') < 0
                && name.indexOf('\\') < 0) {
            return new File(context.getCacheDir(), name);
        }
        throw new FileNotFoundException("Unknown image URI");
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public String getType(Uri uri) {
        return CAPTURE_FILE_NAME.equals(uri.getLastPathSegment()) ? "image/jpeg" : "image/png";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        Context context = getContext();
        if (context == null) throw new FileNotFoundException("Provider context unavailable");
        File file = resolveFile(context, uri);
        boolean writable = CAPTURE_FILE_NAME.equals(file.getName()) && mode.contains("w");
        int flags = writable
                ? ParcelFileDescriptor.MODE_CREATE
                    | ParcelFileDescriptor.MODE_TRUNCATE
                    | ParcelFileDescriptor.MODE_READ_WRITE
                : ParcelFileDescriptor.MODE_READ_ONLY;
        return ParcelFileDescriptor.open(file, flags);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        String[] columns = projection == null
                ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}
                : projection;
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        MatrixCursor.RowBuilder row = cursor.newRow();
        Context context = getContext();
        File file = null;
        if (context != null) {
            try {
                file = resolveFile(context, uri);
            } catch (FileNotFoundException ignored) {
            }
        }
        for (String column : columns) {
            if (OpenableColumns.DISPLAY_NAME.equals(column)) {
                row.add(file == null ? uri.getLastPathSegment() : file.getName());
            } else if (OpenableColumns.SIZE.equals(column)) {
                row.add(file == null ? 0 : file.length());
            } else {
                row.add(null);
            }
        }
        return cursor;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        Context context = getContext();
        if (context == null) return 0;
        try {
            return resolveFile(context, uri).delete() ? 1 : 0;
        } catch (FileNotFoundException ignored) {
            return 0;
        }
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
