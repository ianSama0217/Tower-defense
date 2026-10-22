import com.sun.media.sound.AudioSynthesizer;
import javax.sound.midi.*;
import javax.sound.sampled.*;
import java.io.*;
import java.util.*;
import java.util.prefs.*;

/** Offline MIDI render; the shipped game needs only the resulting audio files.
 * Compile with javac --add-exports java.desktop/com.sun.media.sound=ALL-UNNAMED.
 * Run the compiled RenderMusic class with the same export flag and input.mid output.wav.
 */
public class RenderMusic {
    // Rendering does not need to read or change the user's Java preferences.
    public static class MemoryPreferences implements PreferencesFactory {
        private final Preferences root = new AbstractPreferences(null, "") {
            protected void putSpi(String key, String value) {}
            protected String getSpi(String key) { return null; }
            protected void removeSpi(String key) {}
            protected void removeNodeSpi() {}
            protected String[] keysSpi() { return new String[0]; }
            protected String[] childrenNamesSpi() { return new String[0]; }
            protected AbstractPreferences childSpi(String name) { throw new UnsupportedOperationException(); }
            protected void syncSpi() {}
            protected void flushSpi() {}
        };
        public Preferences userRoot() { return root; }
        public Preferences systemRoot() { return root; }
    }
    public static void main(String[] args) throws Exception {
        System.setProperty("java.util.prefs.PreferencesFactory", MemoryPreferences.class.getName());
        Sequence sequence = MidiSystem.getSequence(new File(args[0]));
        if (sequence.getDivisionType() != Sequence.PPQ) throw new IllegalArgumentException("Expected PPQ MIDI");
        AudioSynthesizer synth = (AudioSynthesizer) MidiSystem.getSynthesizer();
        AudioFormat format = new AudioFormat(32000, 16, 2, true, false);
        Map<String, Object> options = new HashMap<>();
        options.put("interpolation", "sinc");
        try (AudioInputStream stream = synth.openStream(format, options)) {
            Receiver receiver = synth.getReceiver();
            List<MidiEvent> events = new ArrayList<>();
            for (Track track : sequence.getTracks()) for (int i = 0; i < track.size(); i++) events.add(track.get(i));
            events.sort(Comparator.comparingLong(MidiEvent::getTick));
            long lastTick = 0;
            double micros = 0, tempo = 500000;
            for (MidiEvent event : events) {
                micros += (event.getTick() - lastTick) * tempo / sequence.getResolution();
                lastTick = event.getTick();
                MidiMessage message = event.getMessage();
                if (message instanceof MetaMessage meta) {
                    if (meta.getType() == 0x51) {
                        byte[] data = meta.getData();
                        tempo = ((data[0] & 255) << 16) | ((data[1] & 255) << 8) | (data[2] & 255);
                    }
                } else receiver.send(message, Math.round(micros));
            }
            // A brief release preserves the last note and reverb at the loop boundary.
            long frames = (long) ((micros / 1000000 + .5) * format.getFrameRate());
            AudioSystem.write(new AudioInputStream(stream, format, frames), AudioFileFormat.Type.WAVE, new File(args[1]));
            System.out.printf("%s: %.2f seconds%n", args[1], frames / format.getFrameRate());
        } finally { synth.close(); }
    }
}
