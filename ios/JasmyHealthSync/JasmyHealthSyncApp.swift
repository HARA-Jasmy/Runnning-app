import SwiftUI
import HealthKit

// Independent companion: reads the same HealthKit store as Duffy; no Duffy API.
@main struct JasmyHealthSyncApp: App {
    var body: some Scene { WindowGroup { SyncView() } }
}
struct SyncView: View {
    @State private var token = ""
    @State private var status = "歩数と歩行＋走行距離を確認してから送信します。"
    @State private var busy = false
    @State private var totals: DailyTotals?
    private let health = HKHealthStore()
    var body: some View {
        NavigationStack {
            Form {
                Section("連携") {
                    SecureField("Webアプリで発行した連携コード", text: $token)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    Text("コードは端末に保存しません。Duffyではなく、このアプリに貼り付けてください。")
                }
                Section("Appleヘルスケア") {
                    Text("Duffyと共通の健康データを読み取ります。距離には歩行も含みます。")
                    Button("アクセスを許可して今日のデータを取得") {
                        perform {
                            totals = nil
                            try await health.requestAuthorization(toShare: [], read: Set([HKQuantityType(.stepCount), HKQuantityType(.distanceWalkingRunning)]))
                            let end = Date(), start = Calendar.current.startOfDay(for: end)
                            async let steps = sum(.stepCount, unit: .count(), start: start, end: end)
                            async let meters = sum(.distanceWalkingRunning, unit: .meter(), start: start, end: end)
                            let (s, m) = try await (steps, meters)
                            guard let s, let m else { throw SyncError.noData }
                            let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian)
                            formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"
                            totals = DailyTotals(day: formatter.string(from: start), steps: Int(s.rounded()), distance: Int(m.rounded()))
                            status = "数値を確認して送信してください。"
                        }
                    }.disabled(busy || !HKHealthStore.isHealthDataAvailable())
                    if let totals {
                        Text("\(totals.day) · \(totals.steps) 歩 · \(Double(totals.distance) / 1000, specifier: "%.2f") km")
                        Button("このデータをJasmy Runへ送信") { perform { try await send(totals); status = "同期しました。Webアプリを再読み込みしてください。" } }
                            .disabled(busy || token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
                Section { Text(status) }
            }.navigationTitle("Jasmy Health Sync")
        }
    }
    private func perform(_ operation: @escaping @MainActor () async throws -> Void) {
        busy = true
        Task { @MainActor in
            defer { busy = false }
            do { try await operation() } catch { status = error.localizedDescription }
        }
    }
    private func sum(_ id: HKQuantityTypeIdentifier, unit: HKUnit, start: Date, end: Date) async throws -> Double? {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: HKQuantityType(id), quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate), options: .cumulativeSum) { _, result, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: result?.sumQuantity()?.doubleValue(for: unit)) }
            }
            health.execute(query)
        }
    }
    private func send(_ total: DailyTotals) async throws {
        guard (0...200000).contains(total.steps), (0...500000).contains(total.distance) else { throw SyncError.invalidData }
        var request = URLRequest(url: URL(string: "https://masvfncvfhlhwistwhwf.supabase.co/rest/v1/rpc/sync_health")!)
        request.httpMethod = "POST"; request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("sb_publishable_L4MbgJi5udQXJHuTB-P-oA_0FQ__qcd", forHTTPHeaderField: "apikey")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_token": token.trimmingCharacters(in: .whitespacesAndNewlines), "p_day": total.day, "p_steps": total.steps, "p_distance_m": total.distance])
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { throw SyncError.failed }
    }
}
struct DailyTotals { let day: String; let steps: Int; let distance: Int }
enum SyncError: LocalizedError {
    case noData, invalidData, failed
    var errorDescription: String? {
        switch self {
        case .noData: return "データがないか、読み取りが許可されていません。ヘルスケアの設定を確認してください。既存データは上書きしていません。"
        case .invalidData: return "同期可能な数値の範囲を超えています。"
        case .failed: return "送信できませんでした。通信と連携コードを確認してください。"
        }
    }
}
