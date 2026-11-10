# TV apps

The visualizer as an app for **Android TV / Google TV**, **LG webOS** and **Samsung Tizen**.
All three are the website bundled into one offline package, in TV mode: full screen,
driven by the remote.

Build all three (needs Node, `rsvg-convert`, `zip`, and for Android a JDK 17 plus the Android SDK):

```sh
npm run build:tv            # or: node scripts/build-tv.mjs android | webos | tizen
```

Output in `tv/dist/`:

| File | TV |
|---|---|
| `WMPVisualizer.apk` | Android TV, Google TV, Chromecast with Google TV, Nvidia Shield, Sony/TCL/Philips Android TVs, Fire TV |
| `info.stamko.wmp_<version>_all.ipk` | LG webOS |
| `WMPVisualizer-unsigned.wgt` | Samsung Tizen (must be signed first, see below) |

Quickest route on any smart TV: open **wmp.stamko.info** in the TV's web browser. It switches to TV mode by itself.

## What it can listen to on a TV

TVs do not let apps hear what other apps play (Netflix, Spotify, HDMI inputs), so on a TV the visuals use:

- **Music styles** (all TVs): Techno, House, Hip-hop, Trap, Drum & bass, Party / pop, Rock, Chill / lo-fi.
  The visuals move as if that kind of music were playing, at its typical tempo and groove, without making a sound.
  Put on your music anywhere else and pick the closest style.
- **Demo track** (all TVs): the same generator, audible.
- **Microphone** (Android only): a USB or Bluetooth mic, or a remote with a mic where the TV allows apps to use it.
- **Audio file** (Android only): from USB storage or a file manager.

## Remote

| Button | Action |
|---|---|
| ◀ ▶ | Previous / next visualization |
| ▲ ▼ | Next / previous music style |
| OK, Play/Pause | Pause or resume |
| Back | Open the menu; Back on the menu exits (OK on a source or style returns to the visuals) |
| Red | Random mode on/off |
| Green | 2000s look on/off |
| Yellow | Next Milkdrop preset |
| Blue, Menu | Open the menu |

## Installing

### Android TV / Google TV
1. On the TV: Settings > System > About, press *Android TV OS build* 7 times to unlock developer options, then turn on **USB debugging** (and **Network debugging** if listed).
2. On the computer: `adb connect <tv-ip-address>` then `adb install tv/dist/WMPVisualizer.apk`, and accept the prompt on the TV.
   Without a computer: copy the APK to a USB stick or use the *Send Files to TV* / *Downloader* app, and allow installs from that app.

The APK is signed with a local debug key, which is fine for sideloading. Publishing on Google Play needs your own signing key and a Play Console account.

### LG webOS
1. Create a free account at webostv.developer.lge.com.
2. On the TV install **Developer Mode** from the LG Content Store, sign in, turn on *Dev Mode Status* and *Key Server*, and note the IP address.
3. On the computer (`npx -p @webos-tools/cli@3` before each command if the CLI is not installed):
   ```sh
   ares-setup-device                         # add the TV: its IP, port 9922, user prisoner
   ares-novacom --device tv --getkey         # enter the passphrase shown on the TV
   ares-install --device tv tv/dist/info.stamko.wmp_1.0.0_all.ipk
   ares-launch --device tv info.stamko.wmp
   ```
Developer Mode lasts 1000 hours and can be extended in the Developer Mode app. The LG Content Store needs a seller account and review.

### Samsung Tizen
Samsung TVs only install apps signed with a Samsung certificate tied to your TV, so the `.wgt` here is unsigned.
1. Install **Tizen Studio** with the *Samsung TV Extensions* and *Samsung Certificate Extension* (Package Manager).
2. On the TV: Apps, type `12345` on the remote, turn **Developer mode** on, enter your computer's IP, then restart the TV.
3. In Tizen Studio: Device Manager > connect to the TV's IP. Then Certificate Manager > new **Samsung** certificate profile (sign in with a Samsung account; it reads the TV's DUID).
4. Sign and install:
   ```sh
   tizen package -t wgt -s <your-profile> -- tv/dist/tizen-app
   tizen install -n tv/dist/tizen-app/WMPVisualizer.wgt -t <tv-name>
   ```
The Samsung Apps TV store needs a Samsung seller account and review.
