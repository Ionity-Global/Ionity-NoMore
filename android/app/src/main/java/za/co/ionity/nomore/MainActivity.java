package za.co.ionity.nomore;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NoMoreDevicePlugin.class);
        registerPlugin(NoMoreNearbyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
