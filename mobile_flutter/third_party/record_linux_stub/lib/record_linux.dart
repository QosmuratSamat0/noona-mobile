import 'dart:async';
import 'dart:typed_data';

import 'package:record_platform_interface/record_platform_interface.dart';

class RecordLinux extends RecordPlatform {
  static void registerWith() {
    RecordPlatform.instance = RecordLinux();
  }

  @override
  Future<void> create(String recorderId) async {}

  @override
  Future<void> dispose(String recorderId) async {}

  @override
  Future<Amplitude> getAmplitude(String recorderId) async {
    return Amplitude(current: -160, max: -160);
  }

  @override
  Future<bool> hasPermission(String recorderId, {bool request = true}) async {
    return false;
  }

  @override
  Future<bool> isEncoderSupported(String recorderId, AudioEncoder encoder) async {
    return false;
  }

  @override
  Future<bool> isPaused(String recorderId) async {
    return false;
  }

  @override
  Future<bool> isRecording(String recorderId) async {
    return false;
  }

  @override
  Future<void> pause(String recorderId) async {}

  @override
  Future<void> resume(String recorderId) async {}

  @override
  Future<void> start(String recorderId, RecordConfig config, {required String path}) async {
    throw UnsupportedError('Linux recording is not supported in this Noona build.');
  }

  @override
  Future<Stream<Uint8List>> startStream(String recorderId, RecordConfig config) async {
    throw UnsupportedError('Linux recording is not supported in this Noona build.');
  }

  @override
  Future<String?> stop(String recorderId) async {
    return null;
  }

  @override
  Future<void> cancel(String recorderId) async {}

  @override
  Future<List<InputDevice>> listInputDevices(String recorderId) async {
    return const [];
  }

  @override
  Stream<RecordState> onStateChanged(String recorderId) {
    return const Stream.empty();
  }
}
