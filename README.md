# Face Register

顔情報を登録するシンプルなWebアプリケーション

## 概要

このアプリケーションは、Webカメラを使用して顔を検出し、顔情報とIDを登録することができます。登録された顔情報はブラウザのローカルストレージに保存され、いつでも確認・削除することができます。

## 機能

- Webカメラからのリアルタイム顔検出
- 検出された顔のキャプチャ
- 顔情報とIDの登録
- 登録済み顔情報の表示と管理

## 使用技術

- HTML5
- CSS3
- JavaScript (ES6+)
- [face-api.js](https://github.com/vladmandic/face-api) - 顔検出・認識ライブラリ

## 使用方法

1. アプリケーションを開くと、カメラが自動的に起動します
2. カメラに顔を映し、IDを入力します
3. 「登録」ボタンをクリックすると、顔情報が自動的にキャプチャされ登録されます
4. 登録済み顔情報は画面下部に表示されます

## 注意事項

- このアプリケーションはブラウザのローカルストレージを使用しているため、ブラウザのデータを消去すると登録情報も削除されます
- カメラへのアクセス許可が必要です
- 最新のブラウザ（Chrome, Firefox, Edge など）での使用を推奨します
