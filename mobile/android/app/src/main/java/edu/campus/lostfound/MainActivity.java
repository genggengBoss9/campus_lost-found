package edu.campus.lostfound;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalAddressPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
