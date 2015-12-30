chaika-api
==========

[chaika](https://github.com/chaika/chaika) に 2ch の API を実装する非公式なプロジェクトです。

* [プロジェクトの概要](https://github.com/masami-dev/chaika-api/wiki)
* [2ch API 拡張部の説明](https://github.com/masami-dev/chaika-api/wiki/%E4%BB%98%E5%B1%9E%E6%96%87%E6%9B%B8%28README%29)

### 使用上の注意

このバージョンの chaika は、アドオン名やアドオンIDが元のオリジナル版 chaika とは別のものに変更されているため、オリジナル版とは別のアドオンとして Firefox に認識されます。そのため、オリジナル版と同時にインストールすることができてしまいますが、オリジナル版と同時にインストールされると正常に動作しません。すなわち、オリジナル版との共存はできません。

従いまして、オリジナル版 chaika から移行する際には、**必ず、アドオンマネージャにてオリジナル版 chaika を削除（アンインストール）した後にインストールしてください**。オリジナル版 chaika を削除してもデータや設定はそのまま残り、それらは全て引き継がれます。

2ch API サポートは非公式対応となっており、2ch API 機能を働かせるには所定のAPIキーを入力する必要があります。初めて使用する際には、[2ch API 拡張部の説明](https://github.com/masami-dev/chaika-api/wiki/%E4%BB%98%E5%B1%9E%E6%96%87%E6%9B%B8%28README%29) を参照の上、必要な初期設定を行なってください。

###オリジナル版 chaika との違い

このバージョンの chaika は、元々の chaika に対して 2ch API サポートを追加したカスタム版です。また、オリジナル版では修正されていない既知の不具合もいくつか修正されています。

#### オリジナル版からの変更点一覧

* 2ch API サポートの追加 (2ch API extension v0.11a)
* サイドバーのメニューに chaika-api の組み込みリリースノートを開くリンクを追加
* スレ一覧で一部の2ch実況板の板名が何れも｢実況せんかいｺﾞﾙｧ！｣になる不具合を修正
* hanabi.2ch.net など特定の名前のサーバにある板が板と認識されない不具合を修正
* 本来はchaikaで開けないURLに対してリダイレクタが働いてしまう不具合を修正
* [CBM Custom BBS Menu](http://kita.jikkyo.org/cbm/) でサポートされている主要な掲示板を認識するようにした
* chaikaスレ一覧のURLで、?url= 以降をURLエンコードされていない形式に統一
* 板TOPのブラウザ表示で「chaikaで開く」を選ぶと、URLに chaika_force_browser=1 が残るのを修正
* 設定の「外部板・BBSMENU取得元を追加する」ボタンが効いていなかった不具合を修正
* そのほか、細かな不具合をいくつか修正


----

**以下、オリジナル版 chaika の `README.md`**

----

chaika
======

2ちゃんねるなどの掲示板閲覧をより快適にするアドオンです。

他の専用ブラウザに引けを取らないだけでなく、Firefox と連携した多様な機能を提供します。


Install
-------

[Mozilla 公式サイト](https://addons.mozilla.org/ja/firefox/addon/chaika/)よりインストール可能です。


For Users
---------

### マニュアル・ヘルプ
* [オンラインヘルプ](https://github.com/chaika/chaika/wiki)
* [FAQ(よくある質問)](http://bbs2ch.osdn.jp/?page=FAQ)

### コミュニティ
* [現行スレッド](http://refind2ch.org/search?q=chaika)
* [サポート掲示板](http://jbbs.shitaraba.net/computer/44179/)
* [公式アップローダー](http://bbs2ch.osdn.jp/uploader/upload.php)
* [スキン一覧](http://bbs2ch.osdn.jp/?page=Skin%2F0.4.5)

### 関連
* [bbs2chreader 公式サイト](http://bbs2ch.osdn.jp/)


For Developers
--------------

### プラグイン・関連アドオン・スキン開発
* [開発者の方向けオンラインマニュアル](https://github.com/chaika/chaika/wiki#%E9%96%8B%E7%99%BA%E8%80%85%E3%81%AE%E6%96%B9%E5%90%91%E3%81%91)


### chaika 本体の開発
メイン開発者として参画する、パッチを投稿する、Pull Requestを行う、オンラインヘルプを整備するなど、どのような形での参加であれ大歓迎です。

#### ライセンス
- [MPL 1.1/GPL 2.0/LGPL 2.1](https://github.com/chaika/chaika/blob/develop/chaika/license.txt)


#### テスト環境
* [開発用テスト板](http://jbbs.shitaraba.net/computer/43679/)

#### バグ一覧・ToDo
* 最新バグ一覧: [Issues](https://github.com/chaika/chaika/issues?q=is%3Aopen+is%3Aissue+-label%3Afixed)

* 更新が停止したバグ一覧など
    (新規投稿は上のバグ一覧にお願いします)
    * [旧旧ToDo](https://spreadsheets.google.com/pub?key=pbbe5TFNb21RVxOf7ygNJfg) : b2r 0.5系 (flysonさん作成)
    * [旧ToDo](http://d.hatena.ne.jp/nazodane/20080609/1212999112) : b2r 0.5系 (Nazoさん作成)
    * [launchpad](https://bugs.launchpad.net/bbs2ch) : b2r バグトラッカー
    * [あぼーん改善案](http://bbs2ch.osdn.jp/?page=%A4%A2%A4%DC%A1%BC%A4%F3%B2%FE%C1%B1)
    * [書きこみ改善案](http://bbs2ch.osdn.jp/?page=%BD%F1%A4%AD%B9%FE%A4%DF%B2%FE%C1%B1)
    * [bbs2chreader開発板](http://jbbs.shitaraba.net/computer/41231/): Nazoさん作成の旧開発板

#### ブランチモデル
基本規則は [ぼくが実際に運用していたGitブランチモデルについて ::ハブろぐ](http://havelog.ayumusato.com/develop/git/e513-git_branch_model.html) に準拠。

* **master**
  主にリリース版のタグ付専用として使用。直接コミットはせず、基本的にマージのみ。
* **develop**
  開発用のブランチ。
* **feature**
  大規模修正用のブランチ。
* **release**
  リリース候補用のブランチ。AMOは登録に時間がかかるため、登録が完了するまではこちらでバグフィックスする。開発はdevelopブランチで継続する。
