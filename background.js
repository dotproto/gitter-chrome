'use strict';

var debug = true;

function log() {
  console.log.apply(console, arguments);
}

function debug() {
  if (debug) {
    console.debug.apply(console, arguments);
  }
}

function promiseChain(opts) {
  return new Promise(function(resolve, reject) {
    resolve(opts);
  })
}

function urlParser(url) {
  var el = document.createElement('a');
  el.href = url;

  return el;
}

function getTab() {
  return new Promise(function(resolve, reject) {
    chrome.tabs.getSelected(null, function(tab) {
      resolve(tab);
    });
  });
}

function getRoomFromTab(tab) {
  return getTab().then(function(tab) {
    var parser = urlParser(tab.url);
    
    return {
      owner: parser.pathname.split('/')[1] || null,
      name:  parser.pathname.split('/')[2] || null,
      tabId: tab.id
    };
  });
}

function roomCheckSuccess(request) {
  // TODO: Improve status checks once API provides additional data
  // 
  // request.exists   - (Boolean) Does the room exist?
  // request.public   - (Boolean) Is the room publicly accessible?
  // request.joinable - (Boolean) Can the current user join the room?
  //                      false - user has perms || room is public
  //                      false - user doesn't have perms && room is private
  // request.makable  - (Boolean) Can the current user create the room?
  //                      true  - room doesn't exist && user has perms
  //                      false - room already exists || user doesn't have perms

  // 200 = room is public and exists (request.exists == true)
  // 302 = room is private           (request.isPrivate == true)
  // 401 = room does not exist       (request.exists == false)
  if(request.status === 200) {

    chrome.pageAction.setIcon({
      tabId: request.tabId,
      path: 'icon.png'
    });
    chrome.pageAction.show(request.tabId);
    // chrome.pageAction.setPopup({
    //   tabId: request.tabId,
    //   popup: 'page_action/popup.html'
    // })
  }
}

function roomCheckError(error) {
  console.error(error);
}

// room (Object)
// room.name  - name of the room (e.g. gitter)
// room.owner - User or organization that owns the room (e.g. gitterHQ)
function roomCheck(room) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.addEventListener('load', function(){
      console.info('API resp', room.owner + room.name)
      req.tabId = room.tabId;
      resolve(req);
    }, false);
    req.addEventListener('error', reject, false);

    room.name = room.name ? '/' + room.name : '';
    var host = 'http://localhost:3000/room/';
    var url = host + room.owner + room.name;
    req.open('GET', url, true);
    req.setRequestHeader('Content-Type', 'application/json');
    console.info('API req', room.owner + room.name)
    req.send();
  });
}

function updatePageAction(tabId, tab) {
  var parser = urlParser(tab.url);

  if(parser.hostname === 'github.com' || parser.hostname === 'www.github.com') {
    // Found a GitHub page! That means there may be a room here ...

    getRoomFromTab()
      .then(roomCheck)
      .then(
        roomCheckSuccess,
        roomCheckError
      );
  } else {
    // noop - we don't care about this URL
  }
}

// -- Event handlers -----------------------------------------------------------
// The following event handlers normalize contexts in which the page action
// will need to get checked.
function onActivated(activeInfo) {
  var tabId = activeInfo.tabId;
  chrome.tabs.get(tabId, function(tab) {
    console.info('enter onActivated', tab.url);
    updatePageAction(tabId, tab);
  });
}

function onCreated(tab) {
  console.info('enter onCreated', tab.url);
  updatePageAction(tab.id, tab);
}

function onUpdated(tabId, changeInfo, tab) {
  console.info('enter onUpdate', tab.url);
  updatePageAction(tabId, tab);
}

function actionClicked() {
  // TODO: Rather than create a new tab every time, switch to the appropriate tab
  chrome.tabs.create({
    active: true,
    url: 'https://gitter.im/' + getRoomPath()
  }, function(){ /* ... */});
}

// -- Register tab event handlers ----------------------------------------------
// Re-check URL whenever the user navigates
chrome.tabs.onUpdated.addListener(onUpdated);

// Whenever the user switches to another tab, check the new tab
chrome.tabs.onActivated.addListener(onActivated);

// Cover cases where a home page is set to a Github page(Overkill?)
chrome.tabs.onCreated.addListener(onCreated); 


// -- Register action event handlers -------------------------------------------
chrome.pageAction.onClicked.addListener(actionClicked);


