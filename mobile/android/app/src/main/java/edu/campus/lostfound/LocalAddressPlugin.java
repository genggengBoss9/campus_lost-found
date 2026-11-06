package edu.campus.lostfound;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.Enumeration;

@CapacitorPlugin(name = "LocalAddress")
public class LocalAddressPlugin extends Plugin {

    @PluginMethod
    public void getAddresses(PluginCall call) {
        JSArray addresses = new JSArray();
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            if (interfaces == null) {
                call.reject("Could not read this phone's address.");
                return;
            }
            for (NetworkInterface network : Collections.list(interfaces)) {
                for (InetAddress address : Collections.list(network.getInetAddresses())) {
                    if (!(address instanceof Inet4Address) || address.isLoopbackAddress()) {
                        continue;
                    }
                    String host = address.getHostAddress();
                    if (host != null && !host.startsWith("169.254.")) {
                        addresses.put(host);
                    }
                }
            }
        } catch (Exception exception) {
            call.reject("Could not read this phone's address.");
            return;
        }

        JSObject result = new JSObject();
        result.put("addresses", addresses);
        call.resolve(result);
    }
}
