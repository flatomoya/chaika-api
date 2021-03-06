/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is bbs2chreader.
 *
 * The Initial Developer of the Original Code is
 * flyson.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    flyson <flyson at users.sourceforge.jp>
 *    nodaguti <nodaguti at gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const { interfaces: Ci, classes: Cc, results: Cr, utils: Cu } = Components;

let { Browser } = Cu.import('resource://chaika-modules/utils/Browser.js', {});
let { URLUtils } = Cu.import('resource://chaika-modules/utils/URLUtils.js', {});

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaBoard.js");
Components.utils.import("resource://chaika-modules/ChaikaDownloader.js");
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");
Components.utils.import("resource://chaika-modules/ChaikaContentReplacer.js");

var gBoard;
var gSubjectDownloader;
var gSettingDownloader;
var gBoardMoveChecker;
var gNewURL;
var gPageReloaded = false;

/**
 * 開始時の処理
 */
function startup(){
    gPageReloaded = false;
    if(location.protocol === 'chaika:'){
        console.info('This page is loaded in the content process. Reload!');

        let boardXUL = 'chrome://chaika/content/board/page.xul';
        let boardURI = location.pathname.substring(1);
        let params = new URL(location.href).searchParams;

        params.set('url', boardURI);

        // 上の params.set にて url=http%3A%2F%2Fhanabi.2ch.net%2Fqa%2F というように
        // 暗黙でURLエンコードされるが、元々 / と : はクエリパートにそのまま使える文字なので、
        // この２文字に関してはエンコードされていない形式に統一する
        location.href = boardXUL + '?' + params.toString()
                        .replace(/%(2F|3A)/ig, (match, p1) => String.fromCharCode('0x' + p1));
        return;
    }
    // https:の板URLをhttp:でリロードする（変換プロキシを併用する場合への対策）
    if(ChaikaCore.pref.getBool("redirect_https_to_http") &&
       /\burl=https\b/.test(location.search)){
        location.replace(location.href.replace(/\burl=https\b/, "url=http"));
        return;
    }
    gPageReloaded = true;

    PrefObserver.start();

    let params = new URL(location.href).searchParams;
    let boardURI = params.get('url');

    if(!boardURI){
        alert('板 URL が指定されていません．');
        return;
    }

    document.title = boardURI;
    document.getElementById("lblTitle").setAttribute("value", boardURI);

    try{
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var boardURL = ioService.newURI(boardURI, null, null);
        gBoard = new ChaikaBoard(boardURL);
    }catch(ex){
        // 認識できない URL
        alert('サポートされていない種類の板です．');
        return;
    }

    loadPersist();

    // loadPersistで復元された属性値とメニューの表示状態を同期させる
    let filter = document.getElementById("filterGroup");
    filter.value = filter.getAttribute("value");

    var subjectFile = gBoard.subjectFile.clone();
    var settingFile = gBoard.settingFile.clone();

    //前回SETTING.TXTをチェックしてから3ヶ月以上経っていたら更新する
    if(settingFile.exists()){
        let lastModified = settingFile.lastModifiedTime || 0;
        let expire = lastModified + 3 * 30 * 24 * 60 * 60 * 1000;

        if(expire < (new Date()).getTime()){
            settingUpdate();
        }
    }

    if(ChaikaCore.pref.getBool("board.auto_update")){
        subjectUpdate();
    }else if(!subjectFile.exists() || subjectFile.fileSize==0){
        subjectUpdate();
    }else if(gBoard.getItemLength()==0){
        subjectUpdate();
    }else if(!settingFile.exists() || settingFile.fileSize==0){
        settingUpdate();
    }else{
        BoardTree.initTree();
    }

    UpdateObserver.startup();


    //Search Queryが指定されていた時は始めから絞り込んでおく
    var query = params.get('query');

    if(query){
        var searchBox = document.getElementById('searchTextBox');
        searchBox.value = decodeURIComponent(query);
        BoardTree.initTree(true);
    }
}

/**
 * 終了時の処理
 */
function shutdown(){
    if(!gPageReloaded) return;

    PrefObserver.stop();

    if(!BoardTree.firstInitBoardTree){
        savePersist();
    }

        // ダウンロードのキャンセル
    if(gSubjectDownloader && gSubjectDownloader.loading)
        gSubjectDownloader.abort(true);
    if(gSettingDownloader && gSettingDownloader.loading)
        gSettingDownloader.abort(true);
    if(gBoardMoveChecker && gBoardMoveChecker.checking)
        gBoardMoveChecker.abort();

    UpdateObserver.shutdown();
}

/**
 * ブラウザへのイベントフロー抑制
 */
function eventBubbleCheck(aEvent){
    // オートスクロールや Find As You Type を抑制しつつキーボードショートカットを許可
    if(!(aEvent.ctrlKey || aEvent.shiftKey || aEvent.altKey || aEvent.metaKey))
        aEvent.stopPropagation();

    // BoardTree.keyDown() にて Ctrl/Cmd + U を別の動作に割り当てているため、
    // 標準ショートカットキー Ctrl/Cmd + U （ソースの表示）を抑制する
    // tree 以外にフォーカスがある場合も含めて抑制するため、ここに置いている
    if((aEvent.key === 'u' || aEvent.key === 'U') && !aEvent.shiftKey &&
       aEvent.getModifierState("Accel") && !aEvent.altKey){
        aEvent.preventDefault();
    }
}

function loadPersist(){
    var jsonFile = ChaikaCore.getDataDir();
    jsonFile.appendRelativePath("boardPersist.json");
    if(!jsonFile.exists()) return;

    var content = ChaikaCore.io.readString(jsonFile, "UTF-8");
    try{
        var persistData = JSON.parse(content);
        for(var i in persistData){
            var element = document.getElementById(i);
            if(!element) continue;
            for(var j in persistData[i]){
                var attrName = String(j);
                var attrValue = String(persistData[i][j]);
                element.setAttribute(attrName, attrValue);
            }
        }
    }catch(ex){
        ChaikaCore.logger.error(ex + " : " + content);
    }
}

function savePersist(){
    var persistData = {};
    var xpathResult = document.evaluate("descendant::*[@id][@persist2]", document, null,
                        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    for (var i = 0; i < xpathResult.snapshotLength; i++){
        var element = xpathResult.snapshotItem(i);
        var persists = element.getAttribute("persist2").split(/\s/);

        var persistPref = element.getAttribute("persist2pref");
        if(persistPref && !ChaikaCore.pref.getBool(persistPref)) continue;

        for(var j=0; j<persists.length; j++){
            var attrName = persists[j];
            var attrValue = element.getAttribute(attrName);

            if(attrValue != "" && attrValue != "undefined"){
                if(!persistData[element.id]) persistData[element.id] = {};
                persistData[element.id][attrName] = attrValue;
            }
        }
    }

    var jsonFile = ChaikaCore.getDataDir();
    jsonFile.appendRelativePath("boardPersist.json");
    ChaikaCore.io.writeString(jsonFile, "UTF-8", false, JSON.stringify(persistData, null, "  "));
}

function setPageTitle(){
    var boardTitle = gBoard.getTitle();
    document.title = boardTitle + " [chaika]";
    document.getElementById("lblTitle").setAttribute("value", boardTitle.replace(/^実況せんかいｺﾞﾙｧ！＠|[@＠].+$/, ""));
}

var PrefObserver = {

    PREF_BRANCH: "extensions.chaika.board.",

    start: function PrefObserver_start(){
        var prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
        this._branch = prefService.getBranch(this.PREF_BRANCH).QueryInterface(Ci.nsIPrefBranch);
        this._branch.addObserver("", this, false);
    },

    stop: function PrefObserver_stop(){
        this._branch.removeObserver("", this);
    },

    observe: function PrefObserver_observe(aSubject, aTopic, aData){
        if(aTopic != "nsPref:changed") return;

        if(aData == "tree_size"){
            BoardTree.invalidate();
            BoardTree.changeTreeSize();
        }else if(aData == "open_single_click"){
            BoardTree.invalidate();
            BoardTree.changeSingleClick();
        }

    }

};

var BoardTree = {

    tree: null,
    firstInitBoardTree: true,

    initTree: function BoardTree_initTree(aNoFocus){
        this.tree = document.getElementById("boardTree");

        this.changeTreeSize();
        this.changeSingleClick();
        setPageTitle();

        if(this.firstInitBoardTree){
            ChaikaCore.history.visitPage(gBoard.url,
                    ChaikaBoard.getBoardID(gBoard.url), gBoard.getTitle(), 0);
            this.firstInitBoardTree = false;
        }

        var browserWindow = ChaikaCore.browser.getBrowserWindow();
        if(browserWindow && browserWindow.XULBrowserWindow){
            this._XULBrowserWindow = browserWindow.XULBrowserWindow;
        }

        var startTime = Date.now();

        var searchStr = document.getElementById("searchTextBox").value;
        if(searchStr){
            searchStr = "%" + searchStr + "%";
            gBoard.refresh(gBoard.FILTER_LIMIT_SEARCH, searchStr);
        }else{
            var filterLimit = Number(document.getElementById("filterGroup").value);
            gBoard.refresh(filterLimit);
        }


        //スレッドあぼーん処理 および スレタイ置換
        var enableHideAbone = ChaikaCore.pref.getBool('thread_hide_abone');
        var threads = gBoard.itemsDoc.documentElement.getElementsByTagName('boarditem');

        for(let i = 0, iz = threads.length; i < iz; i++){
            let thread = threads[i];

            //透明あぼーんの影響で最後の方は参照できなくなる
            if(!thread) continue;


            //スレッドあぼーん処理
            let hitAboneData = ChaikaAboneManager.shouldAbone({
                title: thread.getAttribute('rawTitle'),
                date: thread.getAttribute('created'),
                thread_url: thread.getAttribute('url'),
                board_url: gBoard.url.spec,
                isThread: true
            });

            if(hitAboneData){
                if(hitAboneData.hide === true ||
                   hitAboneData.hide === undefined && enableHideAbone){
                    thread.parentNode.removeChild(thread);
                    i--;
                    iz--;
                    continue;
                }

                if(hitAboneData.highlight){
                    thread.setAttribute('highlighted', 'true');
                }else{
                    let aboneTitle = '***** ABONE ***** (' + hitAboneData.title + ')';
                    thread.setAttribute('rawTitle', ChaikaCore.io.escapeHTML(aboneTitle));
                    thread.setAttribute('title', aboneTitle);
                }
            }


            //スレタイ置換処理
            let replacedThreadData = ChaikaContentReplacer.replace({
                title: thread.getAttribute('rawTitle'),
                date: thread.getAttribute('created'),
                thread_url: thread.getAttribute('url'),
                board_url: gBoard.url.spec,
                isThreadList: true,
                isSubjectTxt: false
            });

            if(replacedThreadData){
                thread.setAttribute('rawTitle', replacedThreadData.title);
                thread.setAttribute('title', ChaikaCore.io.convertToPlainText(replacedThreadData.title));
            }
        }


        this.tree.builder.datasource = gBoard.itemsDoc.documentElement;
        this.tree.builder.rebuild();

        ChaikaCore.logger.debug("Tree Build Time: " + (Date.now() - startTime));

            // 前回のソートを復元
        var colNodes = document.getElementsByClassName("boardTreeCol");
        for(var i=0; i<colNodes.length; i++){
            if(colNodes[i].getAttribute("sortActive") == "true"){
                // builderView.sort() はカラムヘッダをクリックするのと同じ効果を持つ。
                // すでに sortActive なカラムを指定するとソート順が反転するので、
                // 呼ぶ前に sortDirection を一つ前の状態に戻しておく必要がある。
                // <treecol> に sorthints="twostate" を付けているため "natural" は無い
                var sortDirection = colNodes[i].getAttribute("sortDirection");
                if(sortDirection == "descending"){
                    colNodes[i].setAttribute("sortDirection", "ascending");
                }else{
                    colNodes[i].setAttribute("sortDirection", "descending");
                }
                this.tree.builderView.sort(colNodes[i]);
            }
        }

            // フォーカス
        if(!aNoFocus){
            this.tree.focus();
            this.tree.treeBoxObject.view.selection.select(0);
        }

    },

    changeTreeSize: function BoardTree_changeTreeSize(){
        this.tree.className = this.tree.className.replace(/tree-text-\w+/g, '');
        this.tree.classList.add('tree-text-' + ChaikaCore.pref.getChar("board.tree_size"));
    },

    changeSingleClick: function BoardTree_changeSingleClick(){
        if(ChaikaCore.pref.getBool("board.open_single_click")){
            this.tree.classList.add('single-click');
        }else{
            this.tree.classList.remove('single-click');
        }
    },

    invalidate: function BoardTree_invalidate(){
        this.tree.collapsed = true;
        // 時間間隔が20ms以下だと効果が無い場合があるようです
        setTimeout(() => this.tree.collapsed = false, 50);
    },

    click: function BoardTree_click(aEvent){
        if(aEvent.originalTarget.localName == "tree"){
            // tree のボーダーをクリックしたときの ContextMenu を抑制する
            // see this.showContext
            aEvent.preventDefault();
            return;
        }
        if(aEvent.originalTarget.localName != "treechildren") return;
        if(this.getClickItemIndex(aEvent) == -1) return;
        if(aEvent.ctrlKey || aEvent.shiftKey) return;
        if(aEvent.button > 1) return;

        var singleClicked = aEvent.type == "click";
        var openSingleClick = ChaikaCore.pref.getBool("board.open_single_click");
        var openNewTab = ChaikaCore.pref.getBool("board.open_new_tab");

        if(aEvent.button==1 && singleClicked){
            this.openThread(!openNewTab);
        }else if(openSingleClick && singleClicked){
            this.openThread(openNewTab);
        }else if(!openSingleClick && !singleClicked){
            this.openThread(openNewTab);
        }
    },

    keyDown: function BoardTree_keyDown(aEvent){
        // CapsLock の影響を打ち消す
        let key = !aEvent.getModifierState("CapsLock") ? aEvent.key :
            aEvent.key.replace(/^[A-Z]$/i, (c) => c < 'a' ? c.toLowerCase() : c.toUpperCase());

        switch(key){
            case 'Enter':
                if(aEvent.repeat) break;
                this.openThread(aEvent.ctrlKey || aEvent.altKey);
                break;

            case ' ':
                if(aEvent.shiftKey){
                    this.tree._moveByPage(-1, 0, aEvent);
                }else{
                    this.tree._moveByPage(1, this.tree.view.rowCount - 1, aEvent);
                }
                break;

            case 'r':
                subjectUpdate();
                break;

            case 'f':
                document.getElementById('searchTextBox').focus();
                break;

            case 'j':
                let nextIndex = this.tree.currentIndex + 1;

                if(nextIndex > this.tree.view.rowCount - 1) nextIndex = this.tree.view.rowCount - 1;

                this.tree.treeBoxObject.view.selection.select(nextIndex);
                this.tree.treeBoxObject.ensureRowIsVisible(nextIndex);
                break;

            case 'k':
                let prevIndex = this.tree.currentIndex - 1;

                if(prevIndex < 0) prevIndex = 0;

                this.tree.treeBoxObject.view.selection.select(prevIndex);
                this.tree.treeBoxObject.ensureRowIsVisible(prevIndex);
                break;

            case 'a':
                if(aEvent.getModifierState("Accel") && !aEvent.altKey){
                    // すべて選択 Ctrl/Cmd + A
                    this.tree.treeBoxObject.view.selection.selectAll();
                }
                break;

            case 'u':
                if(aEvent.getModifierState("Accel") && !aEvent.altKey){
                    // 未読をすべて選択 Ctrl/Cmd + U (see also eventBubbleCheck())
                    let n = this.selectAllMatch("boardTreeCol-status", (p) => p.startsWith("s2"));
                    setStatus(n > 0 ? "未読スレッド " + n + "件を選択" :
                                      "未読スレッドはありません", 3000);
                    if(n == 0) Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound).beep();
                    break;
                }
                // fall through
            case 'U':
                if(!aEvent.getModifierState("Accel") && !aEvent.altKey){
                    // 次の(前の)未読へ移動 (Shift +) U
                    let m = this.moveToNextMatch((key == "U"),
                                                 "boardTreeCol-status", (p) => p.startsWith("s2"));
                    setStatus(m.total > 0 ? "未読スレッド " + m.current + " / " + m.total :
                                            "未読スレッドはありません", 3000);
                    if(m.total == 0) Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound).beep();
                }
                break;

        }
    },

    mouseMove: function BoardTree_mouseMove(aEvent){
        if(!this._XULBrowserWindow) return;
        if(aEvent.originalTarget.localName != "treechildren") return;

        var index = this.getClickItemIndex(aEvent);
        if(index == -1) return;
        if(index == this._lastMouseOverIndex) return;

        this._XULBrowserWindow.setOverLink(this.getItemURL(index).spec, null);

        this._lastMouseOverIndex = index;
    },

    mouseOut: function BoardTree_mouseOut(aEvent){
        if(!this._XULBrowserWindow) return;

        this._XULBrowserWindow.setOverLink("", null);
    },

    showContext: function BoardTree_showContext(aEvent){
            // ツリーのアイテムをクリックしたかチェックする
            // NOTE: キーボード操作でコンテキストメニューが開かれる場合、
            // <tree>以下の要素へのスタイル適用状態（特に border,padding など）
            // によって座標計算が正しくなくなり、aEvent.clientX/Y の示す位置が
            // ツリーアイテムから外れてしまう場合がある（Firefix 38,44 にて確認）。
            // キーボードのときはフォーカスのある tree が triggerNode となるので、
            // この場合は座標位置によるチェックをバイパスする。
        if(aEvent.originalTarget.triggerNode.localName != "tree" &&
           this.getClickItemIndex(aEvent) == -1) return false;

        var currentIndex = this.tree.currentIndex;
        var selectionIndices = this.getSelectionIndices();

        var currentInSelection = selectionIndices.indexOf(currentIndex);

        // 選択アイテムの中でフォーカスが当たっているものがあれば先頭へ移動
        // フォーカスが常に選択アイテムの上にあるとは限らない
        if(currentInSelection >= 1){
            selectionIndices.splice(currentInSelection, 1);
            selectionIndices.unshift(currentIndex);
        }

        var items = selectionIndices.map(function(aElement, aIndex, aArray){
            var title = BoardTree.getItemTitle(aElement);
            var urlSpec = BoardTree.getItemURL(aElement).spec;
            return new ChaikaCore.ChaikaURLItem(title, urlSpec, "thread", gBoard.type);
        });

        var boardTreeContextMenu = document.getElementById("boardTreeContextMenu");
        boardTreeContextMenu.items = items;

        return true;
    },

    getClickItemIndex: function BoardTree_getClickItemIndex(aEvent){
        var row = {}
        var obj = {}
        this.tree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, obj);
        if(!obj.value) return -1;
        return row.value;
    },

    getItemURL: function BoardTree_getItemURL(aIndex){
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

        var titleColumn = this.tree.columns.getNamedColumn("boardTreeCol-title");
        var spec = this.tree.builder.getCellValue(aIndex, titleColumn);

        return ioService.newURI(spec, null, null);
    },

    getItemTitle: function BoardTree_getItemTitle(aIndex){
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

        var titleColumn = this.tree.columns.getNamedColumn("boardTreeCol-title");
        return this.tree.builder.getCellText(aIndex, titleColumn);
    },

    getSelectionIndices: function BoardTree_getSelectionIndices(){
        var resultArray = new Array();

        var rangeCount = this.tree.treeBoxObject.view.selection.getRangeCount();
        for(var i=0; i<rangeCount; i++){
            var rangeMin = {};
            var rangeMax = {};

            this.tree.treeBoxObject.view.selection.getRangeAt(i, rangeMin, rangeMax);
            for (var j=rangeMin.value; j<=rangeMax.value; j++){
                resultArray.push(j);
            }
        }
        return resultArray;
    },

    openThread: function BoardTree_openThread(aAddTab){
        var currentIndex = this.tree.currentIndex;
        var selectionIndices = this.getSelectionIndices();

        var currentInSelection = selectionIndices.indexOf(currentIndex);

        // フォーカスが当たっているものがあれば先頭へ移動
        if(currentInSelection >= 1){
            selectionIndices.splice(currentInSelection, 1);
            selectionIndices.unshift(currentIndex);
        }

        selectionIndices.every((index) => {
            ChaikaCore.browser.openThread(this.getItemURL(index), aAddTab, true, false, true);
            return aAddTab;   // false なら最初の一つだけを開く
        });
    },

    moveToNextMatch: function BoardTree_moveToNextMatch(aPrev, aColumnID, aCallback){
        // callback が true を返す行へ移動する（aPrev:上方向へ）
        let col = this.tree.columns.getNamedColumn(aColumnID);
        let view = this.tree.view;
        let match = [];

        for(let idx = 0, rc = view.rowCount; idx < rc; idx++){
            if(aCallback(view.getCellProperties(idx,col)/*, view.getCellValue(idx,col),
                         view.getCellText(idx,col), view.getRowProperties(idx)*/)){
                if(aPrev) match.unshift(idx);
                else match.push(idx);
            }
        }

        let curIdx = this.tree.currentIndex;
        let select = match.findIndex(aPrev ? (idx) => idx < curIdx : (idx) => idx > curIdx);
        if(select == -1) select = 0;

        if(match.length > 0){
            view.selection.select(match[select]);
            this.tree.treeBoxObject.ensureRowIsVisible(match[select]);
        }

        return { total: match.length, current: aPrev ? match.length - select : select + 1 };
    },

    selectAllMatch: function BoardTree_selectAllMatch(aColumnID, aCallback){
        // callback が true を返す行を全て選択する
        let col = this.tree.columns.getNamedColumn(aColumnID);
        let view = this.tree.view;
        let match = [];

        view.selection.clearSelection();

        // 最後に選択した行に currentIndex が移動するので、
        // 選択範囲の一番上に currentIndex が来るように下から上の順に選択する

        for(let idx = view.rowCount; --idx >= 0; ){
            if(aCallback(view.getCellProperties(idx,col)/*, view.getCellValue(idx,col),
                         view.getCellText(idx,col), view.getRowProperties(idx)*/)){
                match.push(idx);
            }
        }

        if(match.length > 0){
            while(match.length > 0){
                let start = match.shift(), end = start;
                while(match[0] === end - 1) end = match.shift();
                view.selection.rangedSelect(start, end, true);
            }
            this.tree.treeBoxObject.ensureRowIsVisible(this.tree.currentIndex);
        }

        return view.selection.count;
    },

    dragStart: function BoardTree_dragStart(aEvent){
        if(aEvent.originalTarget.localName != "treechildren") return;
        var itemIndex = this.getClickItemIndex(aEvent);
        if(itemIndex == -1) return;
        if(this.getSelectionIndices().length != 1) return;

        var url = this.getItemURL(itemIndex).spec;
        var title = this.getItemTitle(itemIndex);

        var dt = aEvent.dataTransfer;
        dt.setData("text/x-moz-url", url + "\n" + title);
        dt.setData("text/unicode", url);

        dt.effectAllowed = "link";
        dt.addElement(aEvent.originalTarget);
        aEvent.stopPropagation();
    }

};

function setStatus(aString, aTimeout){
    let status = document.getElementById("lblStatus");
    status.value = aString;

    if(setStatus.timeoutID){
        clearTimeout(setStatus.timeoutID);
        setStatus.timeoutID = undefined;
    }
    if(!aTimeout) return;
    setStatus.timeoutID = setTimeout((aStatus) => {
        setStatus.timeoutID = undefined;
        aStatus.value = "";
    }, aTimeout, status);
}

/**
 * subject.txt をダウンロードする
 */
function subjectUpdate(aForceUpdate){
        // ダウンロード間隔の制限
    var subjectFile = gBoard.subjectFile.clone();
    var settingFile = gBoard.settingFile.clone();
    if(subjectFile.exists() && !aForceUpdate){
        var interval = new Date().getTime() - subjectFile.lastModifiedTime;
        var updateIntervalLimit =  ChaikaCore.pref.getInt("board.update_interval_limit");
            // 不正な値や、10 秒以下なら 10 秒にする
        if(isNaN(parseInt(updateIntervalLimit)) || updateIntervalLimit < 10)
            updateIntervalLimit = 10;

        if(interval < updateIntervalLimit * 1000){
            if(!settingFile.exists() || settingFile.fileSize==0){
                settingUpdate();
            }else{
                BoardTree.initTree();
            }
            return;
        }
    }

    gSubjectDownloader = new ChaikaDownloader(gBoard.subjectURL, gBoard.subjectFile);

    gSubjectDownloader.onStart = function(aDownloader){
        setStatus("start: " + this.url.spec);
    };

    gSubjectDownloader.onStop = function(aDownloader, aStatus){
        setStatus("");

        var subjectFile = gBoard.subjectFile.clone();
        var settingFile = gBoard.settingFile.clone();

        if(aStatus === 301 || aStatus === 302 ||
           !subjectFile.exists() || subjectFile.fileSize === 0){
            setStatus("スレッド一覧を取得できませんでした。板の移転を確認しています...");
            return checkBoardRelocation();
        }

        gBoard.boardSubjectUpdate();

        if(!settingFile.exists() || settingFile.fileSize === 0){
            settingUpdate();
        }else{
            BoardTree.initTree();
        }
    };

    gSubjectDownloader.onProgressChange = function(aDownloader, aPercentage){
        setStatus("downloading: " + aPercentage + "%");
    };

    gSubjectDownloader.onError = function(aDownloader, aErrorCode){
        setStatus("ネットワークの問題により、スレッド一覧を取得できませんでした。");
    };


    gSubjectDownloader.download();
    setStatus("request: " + gSubjectDownloader.url.spec);
}

/**
 * SETTING.TXT をダウンロードする
 */
function settingUpdate(){
    gSettingDownloader = new ChaikaDownloader(gBoard.settingURL, gBoard.settingFile);

    gSettingDownloader.onStart = function(aDownloader){
        setStatus("start: " + this.url.spec);
    };
    gSettingDownloader.onStop = function(aDownloader, aStatus){
        setStatus("");
        BoardTree.initTree();
    };
    gSettingDownloader.onProgressChange = function(aDownloader, aPercentage){
        setStatus("downloading: " + aPercentage + "%");
    };
    gSettingDownloader.onError = function(aDownloader, aErrorCode){
        if(aErrorCode == ChaikaDownloader.ERROR_NOT_AVAILABLE){
            setStatus("Download Error: NOT AVAILABLE: " + this.url.spec);
        }
    };

    gSettingDownloader.download();
    setStatus("request: " + gSettingDownloader.url.spec);
}

function showBrowser(aTab){
    if(aTab){
        document.getElementById("popTools").hidePopup();
    }

    let url = URLUtils.unchaikafy(gBoard.url.spec);
    let params = new URL(url).searchParams;

    params.set('chaika_force_browser', 1);

    Browser.open(url + '?' + params, aTab);
}

function openLogsDir(){
    ChaikaCore.io.reveal(gBoard.subjectFile.parent);
}

function postNewThread(){
    ChaikaCore.browser.openWindow("chrome://chaika/content/post/wizard.xul", null, gBoard.url.spec, true);
}

function openSettings(){
    ChaikaCore.browser.openWindow("chrome://chaika/content/settings/settings.xul#paneBoard", "chaika:settings");
}

function showBanner(aEvent){
    if(aEvent.type=="click" && aEvent.button!=0) return;

    var imgBanner = document.getElementById("imgHiddenBanner");
    imgBanner.removeAttribute("src");
    imgBanner.setAttribute("src", gBoard.getLogoURL().spec);
}

function bannerLoaded(){
    var imgBanner = document.getElementById("imgBanner");
    imgBanner.setAttribute("src", gBoard.getLogoURL().spec);

    var lblShowBanner = document.getElementById("lblShowBanner");
    var popBanner = document.getElementById("popBanner");

    popBanner.openPopup(lblShowBanner, 0, 0, "end", false, true);
}

function bannerLoadError(aEvent){
    alert("バナーの読み込みに失敗しました");
}

function checkBoardRelocation(){
    gBoardMoveChecker = new NewBoardURLFinder();

    gBoardMoveChecker.onSuccess = function(aNewURL){
        var shouldMove = confirm(aNewURL + ' への移転を確認しました。新しい URL へ移動しますか？');

        if(shouldMove){
            moveToNewURL(aNewURL);
        }
    };

    gBoardMoveChecker.onFail = function(){
        setStatus("移転先を確認できませんでした。板の URL を再度確認して下さい。");
    };

    gBoardMoveChecker.check(gBoard.url.spec);
}

function moveToNewURL(newURL){
    if(newURL){
        var oldLogDir = ChaikaBoard.getLogFileAtURL(gBoard.url);

        try{
            var subjectFile = gBoard.subjectFile.clone();
            var settingFile = gBoard.settingFile.clone();

            if(subjectFile.exists() && subjectFile.fileSize === 0){
                subjectFile.remove(true);
            }

            if(settingFile.exists() && settingFile.fileSize === 0){
                settingFile.remove(true);
            }

            oldLogDir.remove(false);
        }catch(ex){}

        setTimeout(function(){
            //Search Queryが指定されている時は継承する（次スレ検索など）
            var query = window.location.search.match(/query=[^&]+/);
            query = query ? "?" + query[0] : "";
            window.location.href = "chaika://board/" + newURL + query;
        }, 0);
    }
}


function NewBoardURLFinder(){
}

NewBoardURLFinder.prototype = {

    check: function(aBoardURLSpec){
        if(this._httpReq && this._httpReq.readyState !== 0){
            this._httpReq.abort();
        }

        this._httpReq = new XMLHttpRequest();

        this._httpReq.onreadystatechange = this._onreadystatechange.bind(this);
        this._httpReq.open("GET", aBoardURLSpec);
        this._httpReq.channel.QueryInterface(Ci.nsIHttpChannel);
        this._httpReq.channel.redirectionLimit = 0; // 302 等のリダイレクトを行わない
        this._httpReq.channel.loadFlags |= Ci.nsIHttpChannel.LOAD_BYPASS_CACHE;
        this._httpReq.send(null);
    },

    abort: function(){
        if(this._httpReq && this._httpReq.readyState !== 0){
            this._httpReq.abort();
            this._httpReq = null;
        }
    },

    _onreadystatechange: function(){
        if(this._httpReq.readyState !== 4) return;

        var responseText = this._httpReq.responseText;

        if(this._httpReq.channel.status == Cr.NS_ERROR_REDIRECT_LOOP){
            // 301 or 302 で直接移転先へリダイレクトする場合(2017/7～)
            var location = this._httpReq.getResponseHeader("Location");
            if(location != null) this.onSuccess(location);

        }else if(/Change your bookmark/m.test(responseText)){
            if(responseText.match(/<a href=\"([^\"]+)\">/m)){
                // //hawk.2ch.net/livejupiter/ のような相対URLが書かれている場合もある(2017/3/24)
                this.onSuccess(this._httpReq.channel.URI.resolve(RegExp.$1));
            }
        }else{
            this.onFail();
        }

        this._httpReq = null;
    },

    onChecked: function(aSuccess, aNewURL){}
};


var UpdateObserver = {

    updateInfoList: new Map(),

    startup: function UpdateObserver_startup(){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.addObserver(this, "itemContext:deleteLog", false);
        os.addObserver(this, "findNewThread:update", false);

        if(ChaikaCore.pref.getBool("board.dynamic_update")){
            this._dynamicUpdateEnabled = true;
            os.addObserver(this, "ChaikaThread:update", false);
        }
    },

    shutdown: function UpdateObserver_shutdown(){
        var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
        os.removeObserver(this, "itemContext:deleteLog");
        os.removeObserver(this, "findNewThread:update");

        if(this._dynamicUpdateEnabled){
            os.removeObserver(this, "ChaikaThread:update");
        }
    },

    deleteLogsTreeUpdate: function UpdateObserver_deleteLogsTreeUpdate(aURLs){
        if(!BoardTree.tree.boxObject.beginUpdateBatch) return;

        var xpathResult = gBoard.itemsDoc.evaluate("descendant::boarditem[@read>0]",
                    gBoard.itemsDoc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        BoardTree.tree.boxObject.beginUpdateBatch();
        for (var i=0; i<xpathResult.snapshotLength; i++){
            var element = xpathResult.snapshotItem(i);
            var url = element.getAttribute("url");
            if(aURLs.indexOf(url) != -1){
                element.setAttribute("status", "0");
                element.setAttribute("unread", "0");
                element.setAttribute("read", "0");

                var sort1 = element.getAttribute("countSort")
                    .replace(/^\d+/, (m) => m - element.getAttribute("count"));
                var sort2 = sort1.replace(/^\d+:/, "$&$&");
                element.setAttribute("statusSort", sort1);
                element.setAttribute("readSort",   sort1);
                element.setAttribute("unreadSort", sort2);

                if(this._dynamicUpdateEnabled){
                    this.updateInfoList.delete(gBoard.id + url.match(/\/(\d{9,10})/)[1]);
                }
            }
        }
        BoardTree.tree.boxObject.endUpdateBatch();
    },

    chaikaThreadTreeUpdate: function UpdateObserver_chaikaThreadTreeUpdate(){
        if(this.updateInfoList.size == 0) return;
        BoardTree.tree.boxObject.beginUpdateBatch();

        this.updateInfoList.forEach((updateInfo) => {
            let { threadID: tid, lineCount: read } = updateInfo;
            let node = gBoard.itemsDoc.querySelector(`boarditem[threadID='${tid}']`);
            if(node == null || node.getAttribute("read") == read) return;

            // ステータス・既読数・未読数の更新
            let count  = node.getAttribute("count");
            let status = (read == 0) ? 0 : (count == 0) ? 4 : 1 + (count > read);
            let unread = (read == 0) ? 0 : Math.max(count - read, 0);
            node.setAttribute("status", status);
            node.setAttribute("read",   read);
            node.setAttribute("unread", unread);

            // ソートキーの調整
            let [countSort, numberReverse] = node.getAttribute("countSort").split(":");
            let sortPlace  = countSort - count;
            let statusSort = status + sortPlace;
            let readSort   = read + sortPlace;
            let unreadSort = unread + sortPlace;
            node.setAttribute("statusSort", statusSort +":"+ numberReverse);
            node.setAttribute("readSort",   readSort +":"+ numberReverse);
            node.setAttribute("unreadSort", unreadSort +":"+ readSort +":"+ numberReverse);
        });

        BoardTree.tree.boxObject.endUpdateBatch();
        this.updateInfoList.clear();
    },

    observe: function UpdateObserver_observe(aSubject, aTopic, aData){
        if(aTopic == "itemContext:deleteLog"){
            this.deleteLogsTreeUpdate(aData.split(","));
            return;
        }

        if(aTopic == "findNewThread:update"){
            var newThreadInfo = JSON.parse(aData);
            if(newThreadInfo.boardURL == gBoard.url.spec){
                subjectUpdate(true);
            }
            return;
        }

        if(aTopic == "ChaikaThread:update"){
            let updateInfo = JSON.parse(aData);
            if(updateInfo.threadID.startsWith(gBoard.id)){
                this.updateInfoList.set(updateInfo.threadID, updateInfo);
                this.setTimeoutIdle(this.chaikaThreadTreeUpdate, this, 500);
            }
            return;
        }
    },

    setTimeoutIdle: function UpdateObserver_setTimeoutIdle(aHandler, aThis, aTimeout){
        if(!this._timer) this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        let callback = {
            notify: function(aTimer){
                let thread = Cc["@mozilla.org/thread-manager;1"].getService().currentThread;
                if(thread.hasPendingEvents()){  // 処理待ちのイベントがあるときはさらに待つ
                    aTimer.initWithCallback(callback, aTimeout/10, Ci.nsITimer.TYPE_ONE_SHOT);
                }else{
                    aHandler.call(aThis);
                }
            }
        };
        this._timer.initWithCallback(callback, aTimeout, Ci.nsITimer.TYPE_ONE_SHOT);
    },

    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsISupportsWeakReference,
        Ci.nsIObserver,
        Ci.nsISupports
    ])

};
