# Apple Watch / Duffyとの健康データ連携

Duffyは市販の歩数表示アプリです。自作アプリではありません。
このリポジトリはDuffyのコードを変更せず、同じAppleヘルスケアのデータを
独立したiPhoneアプリで読み取ります。Duffy固有のAPIへの直接接続ではありません。

## 実装済み

- Web: Googleログイン後、マイページで連携コードの発行・失効、今日の値を表示。
- Supabase: `sync_health(text,date,integer,integer)` による本人別の日次上書き。
  トークンはハッシュで保存、他人の健康データの読み取りはRLSで禁止。
- iPhone: `ios/JasmyHealthSync/JasmyHealthSyncApp.swift`。
  HealthKitの歩数と歩行＋走行距離を当日分取得し、確認後にHTTPSで送信。
  トークンはメモリだけに保持。データ未取得・権限不足をゼロとして送らない。

## iPhoneへの導入（未実施）

1. MacのXcodeでiOS App / SwiftUIプロジェクトを作成。iOS 17以上を対象にする。
2. 作成されたAppファイルを上記Swiftファイルで置き換える。
3. Signing & Capabilitiesで自身のApple DeveloperチームとBundle IDを設定し、HealthKitを追加。
4. Infoに `NSHealthShareUsageDescription` を追加。
   値: 「歩数と歩行・走行距離を読み取り、確認後にJasmy Runへ同期します。」
5. 実機で起動し、Webで発行したコードを入力、読み取り許可、数値確認、送信。
6. Webを再読み込みして表示を確認。Watch→iPhoneの同期遅延でDuffy表示と差が出ることがある。

この環境にはXcodeと実機がないためSwiftのビルド、署名、実機同期は未検証。
自動バックグラウンド同期やApp Store公開は含まない。
ブラウザ単独でHealthKitにはアクセスできないため、Web公開だけで自動連携は完了しない。

## 注意

距離は歩行＋走行であり、ランニングだけの距離ではない。GPSランと加算しない。
ランキング・チャレンジ認定へは加算せず、参考値として別表示する。
同じ日の再送は最新値で上書きする。ソース別サンプルを独自に足し合わせない。
既存DBのsource値 `duffy` は互換性のため維持しているが、Duffy由来の証明ではない。
既存APIはDBのUTC日付より未来の日付を拒否するため、日本の0〜9時の当日同期は失敗する。
この制限の変更にはAPI側のタイムゾーン設計が必要。失敗時は成功と表示しない。

参考: https://github.com/patrickrills/Duffy
https://developer.apple.com/documentation/healthkit/hkstatisticsquery
