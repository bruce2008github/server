/**
 * Globals/Constants.
 */
var DB_ROOT = "/db/";
var MV_CONTEXT = new Object();
MV_CONTEXT.mNavTabs = null;
MV_CONTEXT.mQueryHistory = null;
MV_CONTEXT.mClasses = null;
MV_CONTEXT.mFullIntrospection = false;
MV_CONTEXT.mLastQueriedClassName = "";
MV_CONTEXT.mLastQResult = null;
MV_CONTEXT.mSelectedPID = null;
MV_CONTEXT.mPrefix2QName = new Object();
MV_CONTEXT.mQName2Prefix = new Object();
MV_CONTEXT.mQNamesDirty = false;
MV_CONTEXT.mTooltipTimer = null;

/**
 * General-purpose helpers.
 */
function countProperties(pO) { var lR = 0; for(var iP in pO) { if (pO.hasOwnProperty(iP)) lR++; } return lR; }

/**
 * Tooltips.
 * Simple mechanism to bind #thetooltip to any
 * div section on the page.
 */
function bindTooltip(pDiv, pMessage, pPos, pOptions/*{start:_, stop:_, once:_, offy:_}*/)
{
  var lGetOption = function(_pWhat, _pDefault) { return (undefined != pOptions && _pWhat in pOptions) ? pOptions[_pWhat] : _pDefault; }
  var lClearTimeout =
    function()
    {
      if (undefined == MV_CONTEXT.mTooltipTimer)
        return;
      clearTimeout(MV_CONTEXT.mTooltipTimer.timer);
      MV_CONTEXT.mTooltipTimer = null;
    }
  var lDeactivate =
    function()
    {
      // Simply hide the tooltip.
      $("#thetooltip").css("display", "none");
      lClearTimeout();
    }
  var lActivate =
    function()
    {
      // Set the tooltip's text.
      $("#thetooltip").text(pMessage);
      // Set the tooltip's position and make it visible.
      var _lPos;
      if (undefined == pPos)
      {
        _lPos = pDiv.offset();
        var _lTooltipW = $("#thetooltip").outerWidth(true);
        if (_lTooltipW + 5 < _lPos.left)
          _lPos.left -= (_lTooltipW + 5);
        else
          _lPos.left += pDiv.outerWidth(true) + 5;
        _lPos.top += lGetOption('offy', 0);
      }
      else
        _lPos = pPos;
      $("#thetooltip").css("left", _lPos.left + "px").css("top", _lPos.top + "px").css("display", "block");
      // Deactivate automatically after a few seconds.
      if (undefined == MV_CONTEXT.mTooltipTimer || (MV_CONTEXT.mTooltipTimer.task == "activate" && MV_CONTEXT.mTooltipTimer.message == pMessage))
        MV_CONTEXT.mTooltipTimer = {timer:setTimeout(lDeactivate, lGetOption('stop', 1500)), task:"deactivate", message:pMessage};
    }
  var lDelayedActivate =
    function()
    {
      // Cancel any pending automatic tooltip activation/deactivation.
      lClearTimeout();
      // Schedule tooltip activation after a small delay (don't show tooltips right away).
      MV_CONTEXT.mTooltipTimer = {timer:setTimeout(lActivate, lGetOption('start', 500)), task:"activate", message:pMessage};
    }

  if (lGetOption('once', false))
  {
    if (0 != lGetOption('start', 500))
      lDelayedActivate();
    else
      { lClearTimeout(); lActivate(); }
  }
  else
    pDiv.hover(lDelayedActivate, lDeactivate);
}
function bindAutomaticTooltips()
{
  $("#thetooltiptable #automatic div").each(
    function(_pI, _pE)
    {
      var _lId = _pE.id.substr("tooltip_".length);
      var _lDiv = $("#" + _lId);
      if (_lDiv.length > 0) { bindTooltip(_lDiv, $(_pE).text()); }
    });
}

/**
 * CtxMenu
 */
function CtxMenu()
{
  this.mMenu = $("<div />").css("position", "absolute").addClass("ctxmenu").appendTo($("body"));
  this.mMenu.css("display", "none");
  var lThis = this;
  this.clicks = function(_pEvent) { var _lO = lThis.mMenu.offset(), _lW = lThis.mMenu.outerWidth(true), _lH = lThis.mMenu.outerHeight(true); if (_pEvent.pageX < _lO.left || _pEvent.pageX > (_lO.left + _lW) || _pEvent.pageY < _lO.top || _pEvent.pageY > (_lO.top + _lH)) lThis.hide(); return true; }
  this.keys = function(_pEvent) { if (_pEvent.keyCode == 27) { lThis.hide(); return false; } return true; }
  this.hide = function() { lThis.mMenu.css("display", "none"); $(document).unbind("keypress", lThis.keys); $(document).unbind("mousedown", lThis.clicks); }
}
CtxMenu.prototype.addItem = function(pText, pCallback, pUserData, pBold)
{
  var lThis = this;
  var lMenuItem = $("<div />").addClass("ctxmenuitem").appendTo(this.mMenu);
  lMenuItem.append(pBold ? $("<b>" + pText + "</b>") : pText);
  lMenuItem.click(function(_pEvent) { lThis.hide(); if (pCallback) { pCallback(_pEvent, pUserData); } else { console.log("CtxMenu.addItem: unhandled item: " + pText); } });
  lMenuItem.hover(
    function() { $(this).addClass("ctxmenu-highlighted-item"); },
    function() { $(this).removeClass("ctxmenu-highlighted-item"); });
  lMenuItem.appendTo(this.mMenu);
}
CtxMenu.prototype.start = function(pX, pY)
{
  var lThis = this;
  $(document).mousedown(this.clicks);
  $(document).keypress(this.keys);
  this.mMenu.css("left", pX + "px").css("top", pY + "px");
  this.mMenu.css("display", "block");
}
function bindStaticCtxMenus()
{
  // TODO:
  //   Add more suggestions... should try to cover enough basics to help somebody be up&running quickly...
  //   (e.g. graph insert dml, path expressions, collections, more joins etc.)
  // REVIEW: Ideally we should have menu enablers also...

  $("#query").bind(
    "contextmenu", null,
    function(_pEvent)
    { 
      var _lMenu = new CtxMenu();
      var _lSomePID = (undefined != MV_CONTEXT.mSelectedPID ? MV_CONTEXT.mSelectedPID : "50001");
      var _lSomeClass = (undefined != MV_CONTEXT.mClasses && MV_CONTEXT.mClasses.length > 0 ? MV_CONTEXT.mClasses[0]["afy:classID"] : "myclass");
      _lMenu.addItem($("#menuitem_query_pin").text(), function() { $("#query").val("SELECT * FROM @" + _lSomePID + ";"); });
      _lMenu.addItem($("#menuitem_query_class").text(), function() { $("#query").val("SELECT * FROM \"" + _lSomeClass + "\";"); });
      _lMenu.addItem($("#menuitem_query_classft").text(), function() { $("#query").val("SELECT * FROM \"" + _lSomeClass + "\" MATCH AGAINST ('hello');"); });
      _lMenu.addItem($("#menuitem_query_classjoin").text(), function() { $("#query").val("SELECT * FROM myclass1 AS c1 JOIN myclass2 AS c2 ON (c1.myprop1 = c2.myprop2);"); });
      _lMenu.addItem($("#menuitem_query_all").text(), function() { $("#query").val("SELECT *;"); });
      _lMenu.addItem($("#menuitem_query_insertpin").text(), function() { $("#query").val("INSERT (\"myprop\", \"myotherprop\") VALUES (1, {2, 'hello', TIMESTAMP'1976-05-02 10:10:10'});"); });
      //_lMenu.addItem($("#menuitem_query_insertgraph").text(), function() { $("#query").val("INSERT \"myname\"='Fred', \"myfriends\"={(INSERT \"myname\"='John', \"myfriends\"={(SELECT * WHERE \"myname\" MATCH AGAINST('Fr')), (INSERT \"myname\"='Jack')}), (INSERT \"myname\"='Tony')};"); });
      _lMenu.addItem($("#menuitem_query_insertclass").text(), function() { $("#query").val("CREATE CLASS \"myclass\" AS SELECT * WHERE EXISTS(\"myprop\");"); });
      _lMenu.addItem($("#menuitem_query_updatepin").text(), function() { $("#query").val("UPDATE @" + _lSomePID + " SET \"mythirdprop\"=123;"); });
      _lMenu.addItem($("#menuitem_query_deletepin").text(), function() { $("#query").val("DELETE FROM @" + _lSomePID + ";"); });
      _lMenu.addItem($("#menuitem_query_dropclass").text(), function() { $("#query").val("DROP CLASS \"" + _lSomeClass + "\";"); }); 
      _lMenu.start(_pEvent.pageX, _pEvent.pageY);
      return false;
    });

  $("#result_pin").bind(
    "contextmenu", null,
    function(_pEvent)
    { 
      var _lMenu = new CtxMenu();
      _lMenu.addItem($("#menuitem_rp_querypin").text(), function() { if (undefined != MV_CONTEXT.mSelectedPID) { $("#query").val("SELECT * FROM @" + MV_CONTEXT.mSelectedPID + ";"); } });
      _lMenu.addItem($("#menuitem_rp_deletepin").text(), function() { if (undefined != MV_CONTEXT.mSelectedPID) { $("#query").val("DELETE FROM @" + MV_CONTEXT.mSelectedPID + ";"); } });
      _lMenu.start(_pEvent.pageX, _pEvent.pageY);
      return false;
    });

  $("#classes").bind(
    "contextmenu", null,
    function(_pEvent)
    {
      // If there's no class, don't display any ctx menu.
      if (0 == $("#classes option").size())
        return;
      // If there's no selected class, select the first one (+/- simulates click on right-click).
      if (undefined == $("#classes option:selected").val())
        $("#classes option:eq(0)").attr("selected", "selected");
      
      var _lMenu = new CtxMenu();
      _lMenu.addItem($("#menuitem_classes_q").text(), function() { on_class_dblclick(); }, null, true);
      _lMenu.addItem($("#menuitem_classes_q_ft").text(), function() { on_class_dblclick(); var _lQ = $("#query").val(); $("#query").val(_lQ.substr(0, _lQ.length - 1) + " MATCH AGAINST ('hello');"); });
      _lMenu.addItem($("#menuitem_classes_q_drop").text(), function() { $("#query").val("DROP CLASS \"" + $("#classes option:selected").val() + "\";"); }); 
      _lMenu.start(_pEvent.pageX, _pEvent.pageY);
      return false;
    });
}

/**
 * NavTabs.
 * Interprets all <li> nodes of the #nav section as tabs;
 * expects each to contain an <a> anchor,
 * with href pointing to the <div> that defines the tab's contents
 * (super-simplified tab system, not dependent on jquery-ui).
 */
function NavTabs()
{
  var lTabs = [] // An array of {name:, anchor:, content:}.
  var lTabContentFromName = function(_pName) { return $("#" + _pName); }
  var lTabNameFromA = function(_pAnchor) { return _pAnchor.toString().split('#').pop(); }
  var lFindTab = function(_pName) { for (var _i = 0; _i < lTabs.length; _i++) if (_pName == lTabs[_i].name) { return lTabs[_i]; } return null; }
  var lOnTab =
    function(_pEvent)
    {
      // Hide all tabs.
      $.each(lTabs, function(__pI, __pE) { __pE.content.css("display", "none"); $(__pE.anchor).children("img").removeClass("tab-selected"); });
      // Display the selected tab.
      var _lTargetA = $(_pEvent.target).parent()[0];
      var _lTab = lTabContentFromName(lTabNameFromA(_lTargetA));
      $(_lTargetA).children("img").addClass("tab-selected");
      _lTab.css("display", "block");
      _lTab.trigger("activate_tab");
    }
  // For each <li> of #nav, record it as a tab in lTabs, and bind lOnTab to the click event.
  $("#nav li").each(
    function(_pI, _pE)
    {
      var _lAnchor = $("a", _pE)[0];
      var _lTab = {name:lTabNameFromA(_lAnchor), anchor:_lAnchor};
      _lTab.content = lTabContentFromName(_lTab.name);
      lTabs.push(_lTab);
      $("img", _lAnchor).each(
        function(__pI, __pE)
        {
          $(__pE).click(lOnTab);
          $(__pE).hover(function() { $(this).addClass("tab-highlighted"); }, function() { $(this).removeClass("tab-highlighted"); });
          bindTooltip($(__pE), $("#tooltip_" + _lTab.name).text());
        });
    });
  // Select the first tab initially (either from the url, if one is specified, or just by index, otherwise).
  var lLoadedUrl = location.href.split('#');
  lOnTab({target:(lLoadedUrl.length > 1 ? $("img", lFindTab(lLoadedUrl.pop()).anchor) : $("#nav img")[0])});
}

/**
 * QResultTable.
 * Deals with infinitely long results, using pagination and special scollbars.
 * Contains at least 2 columns: PID, Other Properties.
 * When the query is on a class (or eventually join etc.), adds more columns.
 * Goal: improve readability by showing common properties, and also reduce waste of space.
 */
gQrtIndex = 0;
function QResultTable(pContainer, pClassName)
{
  var lThis = this;
  var lEvalVScrollerRowHeight =
    function()
    {
      lThis.mQrtVScroller.css("visibility", "hidden").css("display", "block");
      var _lLine = $("<p>HeightTest</p>").appendTo(lThis.mQrtVScroller);
      var _lH = _lLine.height();
      _lLine.remove();
      lThis.mQrtVScroller.css("display", "none").css("visibility", "visible");
      return _lH;
    }
  this.mInitialized = false;
  this.mAborted = false;
  this.mQrtIndex = gQrtIndex++;
  this.mUIContainer = pContainer; // In this div we will create all the widgets we need to operate our infinite table.
  this.mClassName = pClassName;
  this.mQrtContainer = $("<div id='qrt_cnt_" + this.mQrtIndex + "' class='qrt_cnt' />").appendTo(this.mUIContainer); // This div is used for horizontal scrolling; it contains the table.
  this.mTables = []; // Double-buffering (due to our peculiar pagination mechanism).
  this.mTables.push($("<table id='qrt_table1_" + this.mQrtIndex + "' class='qrt_table' />").appendTo(this.mQrtContainer));
  this.mTables.push($("<table id='qrt_table2_" + this.mQrtIndex + "' class='qrt_table' style='visibility:hidden' />").appendTo(this.mQrtContainer));
  this.mQrtHScroller = $("<div id='qrt_hscroller_" + this.mQrtIndex + "' class='qrt_hscroller' />").appendTo(this.mUIContainer);
  this.mQrtHScrollerContent = $("<div id='qrt_hscroller_content_" + this.mQrtIndex + "' class='qrt_hscroller_content' />").appendTo(this.mQrtHScroller);
  this.mQrtVScroller = $("<div id='qrt_vscroller_" + this.mQrtIndex + "' class='qrt_vscroller' />").appendTo(this.mUIContainer);
  this.mQrtVScrollerContent = $("<div id='qrt_vscroller_content_" + this.mQrtIndex + "' class='qrt_vscroller_content' />").appendTo(this.mQrtVScroller);
  this.mQrtVSNominalRowHeight = lEvalVScrollerRowHeight() + 4; // Hack: To this date, I have failed to identify why this +4 is needed; it reflects the scroll increment actually calculated by the browser, for this scroller's font.
  this.mCurTable = 0; // Next table to update, in the double-buffered mechanism.
  this.mRowCache = {}; // Cache of {rownum:rowdata}.
  this.mRowLRU = []; // Array of rownum, from least recently used to most recently used.
  this.mScrollPos = 0; // Last (raw) scroll position.
  this.mNumRows = 0; // Total number of rows.
  this.mQuery = null; // Query string producing the results.
  this.mQrtVScroller.scroll(function() { lThis._onScroll(this.scrollTop); });
  this.mQrtHScroller.scroll(function() { lThis.mQrtContainer.scrollLeft(this.scrollLeft); });
  $(window).resize(function() { lThis._setNumRows(lThis.mNumRows); lThis._onScroll(lThis.mScrollPos); }); // To avoid half-empty pages when the display grows.
}
QResultTable.PAGESIZE = 50; // Review: Fine-tune this...
QResultTable.CACHE_SIZE = 20 * QResultTable.PAGESIZE; // Note: Must be at least 2*PAGESIZE, to work with internal logic.
QResultTable.prototype.populate = function(pQuery)
{
  var lThis = this;
  if (undefined == pQuery || 0 == pQuery.length)
  {
    this.mQuery = null;
  }
  else if (undefined == pQuery.match(/^\s*select/i))
  {
    // For insert/update/create-class, just run the query once.
    this.mQuery = null;
    var lOnResult = function(_pJson) { lThis._setNumRows(_pJson.length); lThis._recordRows(_pJson, 0); lThis._onScroll(0); };
    mv_query(pQuery, new QResultHandler(lOnResult, null, null));
  }
  else
  {
    // For select, count how many pins are expected for pQuery, and then proceed page by page.
    this.mQuery = pQuery;
    var lOnCount = function(_pJson) { lThis._setNumRows(parseInt(_pJson)); lThis._onScroll(0); };
    mv_query(this.mQuery, new QResultHandler(lOnCount, null, null), {countonly:true});
  }
}
QResultTable.prototype._onScroll = function(pPos)
{
  // See if our cache can satisfy the request.
  var lThis = this;
  this.mScrollPos = pPos;
  var lStartPos = Math.floor(pPos / this.mQrtVSNominalRowHeight);
  var lEndPos = Math.min(lStartPos + QResultTable.PAGESIZE, this.mNumRows);
  for (var iR = lStartPos; iR < lEndPos && (String(iR) in this.mRowCache); iR++);
  if (iR >= lEndPos)
  {
    // If yes, then refresh the UI and we're done.
    setTimeout(function() { lThis._fillTableUI(lThis.mCurTable, pPos); }, 20);
    this.mCurTable = 1 - this.mCurTable;
    return;
  }

  // Otherwise, query a page.
  if (undefined == this.mQuery)
    { alert("Unexpected: no query specified, yet not enough results"); return; }
  if (iR == lStartPos && iR > 0)
  {
    // When scrolling upward, or seeking at a random point, fetch up to half a page upward (and the rest downward).
    var lNewStart = Math.max(0, lStartPos - Math.floor(QResultTable.PAGESIZE / 2));
    for (--iR; iR > lNewStart && !(String(iR) in this.mRowCache); iR--);
  }
  var lOnPage =
    function(_pJson, _pUserData)
    {
      if (undefined == _pJson)
        return;
      lThis._recordRows(_pJson, _pUserData.offset);
      if (_pUserData.pos == lThis.mScrollPos)
        lThis._onScroll(_pUserData.pos);
      if (undefined != lThis.mQuery.match(/^\s*create\s*class/i))
        { populate_classes(); }
    };
  mv_query(this.mQuery, new QResultHandler(lOnPage, null, {offset:iR, pos:pPos}), {limit:QResultTable.PAGESIZE, offset:iR});
}
QResultTable.prototype._setNumRows = function(pNum)
{
  this.mNumRows = pNum;
  var lPhysH = this.mQrtContainer.height();
  var lTotH = lPhysH + this.mQrtVSNominalRowHeight * (pNum - 1);
  this.mQrtVScrollerContent.height(lTotH);
  this.mQrtVScroller.scrollTop(0);
}
QResultTable.prototype._initTables = function(pJson)
{
  if (this.mInitialized)
    return;

  // Determine the column layout (from initial data/page).
  this.mClassProps = new Object();
  this.mCommonProps = new Object(), lCommonProps = new Object();
  var lClass = null;
  if (this.mClassName)
  {
    lClass = function(_pN){ for (var i = 0; null != MV_CONTEXT.mClasses && i < MV_CONTEXT.mClasses.length; i++) { if (MV_CONTEXT.mClasses[i]["afy:classID"] == _pN) return MV_CONTEXT.mClasses[i]; } return null; }(this.mClassName);
    for (var iProp in lClass["afy:properties"])
    {
      var lPName = lClass["afy:properties"][iProp];
      this.mClassProps[lPName] = 1;
    }
  }
  for (var i = 0; i < pJson.length; i++)
  {
    var lPin = (pJson[i] instanceof Array || pJson[i][0] != undefined) ? pJson[i][0] : pJson[i];
    for (var iProp in lPin)
    {
      if (iProp == "id") continue;
      if (iProp in this.mClassProps) continue;
      if (iProp in lCommonProps) { lCommonProps[iProp] = lCommonProps[iProp] + 1; continue; }
      lCommonProps[iProp] = 1;
    }
  }
  for (var iProp in lCommonProps)
  {
    if (lCommonProps[iProp] < (pJson.length / 2)) continue; // Only keep properties that appear at least in 50% of the results.
    this.mCommonProps[iProp] = 1;
  }

  // Initialize the two tables (for double-buffering).
  for (var iT = 0; iT < this.mTables.length; iT++)
    this._initTableUI(iT);

  this.mInitialized = true;
}
QResultTable.prototype._recordRows = function(pQResJson, pOffset)
{
  if (undefined == pQResJson)
    return;
  var lJson = pQResJson;

  // Initialize upon receiving the first batch of results,
  // in order to be able to gather "common" properties, based on that first batch.
  this._initTables(lJson);

  // Throw away least-recently-used items from the cache, if necessary.
  while (this.mRowLRU.length + lJson.length > QResultTable.CACHE_SIZE)
    delete this.mRowCache[String(this.mRowLRU.pop())];
  
  // Create the rows.
  for (var i = 0; i < lJson.length; i++)
  {
    // For now, if an element of the result is a list (result from a JOIN), just take the leftmost pin.
    // When the kernel behavior stabilizes with respect to the structure and contents of JOIN results,
    // we can do more.
    var lPin = (lJson[i] instanceof Array || lJson[i][0] != undefined) ? lJson[i][0] : lJson[i];
    var lK = String(pOffset + i);
    if (lK in this.mRowCache)
      this._removeFromLRU(pOffset + i);
    this.mRowCache[lK] = {pin:lPin};
    this.mRowLRU.push(pOffset + i);
  }
}
QResultTable.prototype._initTableUI = function(pWhich)
{
  // Clear the table.
  var lT = this.mTables[pWhich];
  lT.empty();

  // Create the column headers (PID, class props, common props, other props).
  // REVIEW: We could decide to color-code the sections (class vs common vs other).
  var lHead = $("<thead />").appendTo(lT);
  var lHeadR = $("<tr />").appendTo(lHead);
  lHeadR.append($("<th class='qrt_table_th' align=\"left\">PID</th>"));
  var lClass = null;
  for (var iProp in this.mClassProps)
    lHeadR.append($("<th class='qrt_table_th' align=\"left\">" + iProp + "</th>"));
  for (var iProp in this.mCommonProps)
    lHeadR.append($("<th class='qrt_table_th' align=\"left\">" + iProp + "</th>"));
  lHeadR.append($("<th class='qrt_table_th' align=\"left\">Other Properties</th>"));
  $("<tbody />").appendTo(lT);
}
QResultTable.prototype._fillTableUI = function(pWhich, pPos)
{
  // Use the display height as a way to add the least number of rows possible.
  var lCt = this.mTables[pWhich];
  var lHt = lCt.parent().height();
  var lWt = lCt.parent().width();

  // Remove and recreate the offscreen-table's body.
  lCt.children("tbody").each(function(_pI, _pE) { $(_pE).remove(); });
  $("<tbody />").appendTo(lCt);

  // Add the required rows.
  // Note: We don't sum up the height of individual rows, because the layout engine can make them change as new rows are inserted.
  var lAccH = lCt.height();
  var lStartPos = Math.floor(pPos / this.mQrtVSNominalRowHeight);
  var lEndPos = Math.min(lStartPos + QResultTable.PAGESIZE, this.mNumRows);
  var lSuccess = true;
  for (var iR = lStartPos; iR < lEndPos && ((0 == lHt && undefined == this.mQuery) || lAccH < lHt); iR++, lAccH = lCt.height())
  {
    var lK = String(iR);
    if (!(lK in this.mRowCache)) { lSuccess = false; break; }
    this._removeFromLRU(iR);
    this._addRowUI(pWhich, this.mRowCache[String(iR)].pin);
    this.mRowLRU.push(iR);
  }
  if (!lSuccess)
    { console.log("Couldn't retrieve data in cache"); return; }

  // Hide the vertical scroller, if there aren't enough results.
  // Hack:
  //   The lNormWidth calculation is an approximation, meant to deal with the fact that
  //   a native scroller's physical dimension can't be evaluated precisely (for any zoom level).
  //   This adjustment is required because css pixels are zoomed (while native scrollers aren't);
  //   otherwise the browser sometimes chooses to hide the scroll bars (when zoomed out).
  //   As far as I can tell, this touches an extremely messy aspect of browser coordinate systems.
  // Note:
  //   In ie the scrollbars are scaled along with browser zoom.
  var lNormWidth = ("msie" in $.browser && $.browser["msie"]) ? 20 : Math.round(30 * screen.width / 1800);
  var lNWs = "" + lNormWidth + "px";
  if (0 == pPos && iR <= lEndPos && lAccH < lHt)
  {
    this.mQrtVScroller.css("display", "none");
    this.mQrtContainer.css("right", "0px");
    this.mQrtHScroller.css("right", "0px");
  }
  else
  {
    this.mQrtVScroller.css("display", "block");
    this.mQrtVScroller.css("width", lNWs);
    this.mQrtContainer.css("right", lNWs);
    this.mQrtHScroller.css("right", lNWs);
  }

  // Hide the horizontal scroller, unless necessary.
  if (lCt.width() <= lWt)
  {
    this.mQrtHScroller.css("display", "none");
    this.mQrtContainer.css("bottom", "0px");
    this.mQrtVScroller.css("bottom", lNWs); // Note: Normally this would be 0px, but because we hide/show the horizontal scroller on a page-by-page basis, I want to avoid having the downward scrolling arrow move...
  }
  else
  {
    this.mQrtHScrollerContent.width(lCt.width());
    this.mQrtHScroller.css("display", "block");
    this.mQrtHScroller.css("height", lNWs);
    this.mQrtContainer.css("bottom", lNWs);
    this.mQrtVScroller.css("bottom", lNWs);
  }

  // Swap visibility.
  // Note: Using 'visibility' instead of 'display' allows to obtain row heigths while building the off-screen version.
  this.mTables[1 - pWhich].css("visibility", "hidden");
  lCt.css("visibility", "visible");
}
QResultTable.prototype._addRowUI = function(pWhich, pPin)
{
  // Create a new row and bind mouse interactions.
  var lBody = this.mTables[pWhich].children("tbody");
  var lRow = $("<tr id=\"" + pPin["id"] + "\"/>").appendTo(lBody);
  lRow.mouseover(function(){$(this).addClass("highlighted");});
  lRow.mouseout(function(){$(this).removeClass("highlighted");});
  lRow.click(function(){on_pin_click($(this).attr("id")); return false;});
  var lRefs = new Object();

  // Create the first column.
  lRow.append($("<td>" + pPin["id"] + "</td>"));

  // Create the class-related columns, if any.
  for (var iProp in this.mClassProps)
    { lRow.append($("<td>" + this._createValueUI(pPin[iProp], lRefs, pPin["id"] + "rqt") + "</td>")); }

  // Create the common props columns, if any.
  for (var iProp in this.mCommonProps)
    { lRow.append($("<td>" + (iProp in pPin ? this._createValueUI(pPin[iProp], lRefs, pPin["id"] + "rqt") : "") + "</td>")); }

  // Create the last column (all remaining properties).
  lOtherProps = $("<p />");
  for (var iProp in pPin)
  {
    if (iProp == "id") continue;
    if (iProp in this.mClassProps) continue;
    if (iProp in this.mCommonProps) continue;
    lOtherProps.append($("<span class='mvpropname'>" + iProp + "</span>"));
    lOtherProps.append($("<span>:" + this._createValueUI(pPin[iProp], lRefs, pPin["id"] + "rqt") + "  </span>"));
  }
  var lOPD = $("<td />");
  lOPD.append(lOtherProps);
  lRow.append(lOPD);

  // Bind mouse interactions for references.
  for (iRef in lRefs)
    { $("#" + iRef).click(function(){on_pin_click($(this).text()); return false;}); }  
    
  return lRow;
}
QResultTable.prototype._removeFromLRU = function(pKey)
{
  for (var iLRU = 0; iLRU < this.mRowLRU.length; iLRU++)
    if (this.mRowLRU[iLRU] == pKey) { this.mRowLRU.splice(iLRU, 1); break; }
}
QResultTable.createValueUI = function(pProp, pRefs, pRefPrefix)
{
  if (typeof(pProp) != "object")
    { return pProp; }
  for (var iElm in pProp)
  {
    if (iElm == "$ref")
    {
      pRefs[pRefPrefix + pProp[iElm]] = true;
      return "<a id=\"" + pRefPrefix + pProp[iElm] + "\" href=\"#" + pProp[iElm] + "\">" + pProp[iElm] + "</a>";
    }
    else if (!isNaN(parseInt(iElm)))
    {
      var lElements = new Array();
      for (iElm in pProp)
        { lElements.push(QResultTable.createValueUI(pProp[iElm], pRefs, pRefPrefix)); }      
      return "{" + lElements.join(",") + "}";
    }
    else { console.log("QResultTable.createValueUI: unexpected property: " + iElm); }
  }
}
QResultTable.prototype._createValueUI = QResultTable.createValueUI;

/**
 * BatchingSQL
 */
function BatchingSQL()
{
  var lThis = this;
  this.mQueryAreaQ = $("#query_area_q");
  this.mResultList = $("#result_area_selector");
  this.mResultPage = $("#result_area_page");
  this.mPages = null;
  $("#query_area_go").click(function() { lThis.go(); });
  this.mResultList.change(
    function()
    {
      var _lCurPageQ = $("#result_area_selector option:selected").val();
      $.each(lThis.mPages, function(_pI, _pE) { _pE.ui.css("display", (_pE.query == _lCurPageQ) ? "block" : "none"); });
    });
}
BatchingSQL.prototype.go = function()
{
  this.mResultList.empty();
  this.mResultPage.empty();
  this.mPages = new Array();
  var lThis = this;
  var lQueries = this.mQueryAreaQ.val().replace(/\n/g,"").split(';');
  var lOnResults =
    function(_pJson)
    {
      if (0 == _pJson.length || lQueries.length < _pJson.length)
        return;
      for (var iQ = 0; iQ < _pJson.length; iQ++)
      {
        var _lPage = {ui:$("<div style='overflow:hidden; position:absolute; top:30px; width:100%; height:100%;'/>"), query:(lQueries[iQ] + ";"), result:null};
        _lPage.result = new QResultTable(_lPage.ui, null);
        MV_CONTEXT.mQueryHistory.recordQuery(_lPage.query);
        lThis.mResultList.append($("<option>" + _lPage.query + "</option>"));
        lThis.mPages.push(_lPage);
        lThis.mResultPage.append(_lPage.ui);
        _lPage.result._setNumRows(_pJson[iQ].length);
        _lPage.result._recordRows(_pJson[iQ], 0);
        _lPage.result._onScroll(0);
        _lPage.ui.css("display", "none");
      }
    };
  mv_batch_query(lQueries, new QResultHandler(lOnResults, function(_pError){ print("error:" + _pError[0].responseText); }), {sync:true});
  if (this.mPages.length > 0)
    this.mPages[0].ui.css("display", "block");
}

/**
 * Query History.
 * Stores a history of every query requested by the user (using persist.js),
 * and allows to navigate/reuse that history.
 * Note:
 *   At least for the time being, I decided not to store this history on the server,
 *   because I didn't want to spend time dealing with the security implications,
 *   and because I prefer to keep this tool as non-intrusive as possible.
 */
function QHistory(pContainer, pUIStore)
{
  var lThis = this;
  this.mStore = pUIStore;
  this.mTable = $("<table id='qhistorytable' width=\"100%\" />").appendTo(pContainer);
  $("#query_history_clear").click(function() { lThis.clearHistory(); });
  this._init();
}
QHistory.prototype._init = function()
{
  // Clear the table.
  this.mTable.empty();

  // Append the already existing rows.
  var lBody = $("<tbody id='qhistorybody' />").appendTo(this.mTable);
  var lThis = this;
  this._iterate(function(_pK, _pV) { if (undefined != _pV) lThis._addRow(_pK, _pV); });
}
QHistory.prototype._iterate = function(pHandler)
{
  // Note:
  //   On chrome, with localstorage, persist.js's iterate method appears not to work;
  //   this is a substitute implementation, based on our knowledge of our keys semantics;
  //   it replaces: this.mStore.iterate(pHandler);
  if (undefined == this.mStore)
    return;
  try
  {
    var lLastKey = this.mStore.get('hist_lastkey');
    if (undefined != lLastKey)
    {
      lLastKey = parseInt(lLastKey);
      for (var i = 1; i <= lLastKey; i++)
      {
        var lKey = 'hist_' + i.toString();
        var lVal = this.mStore.get(lKey);
        pHandler(lKey, lVal);
      }
    }
  }
  catch(e) { console.log("QHistory._init: " + e); }
}
QHistory.prototype._removeRow = function(pKey)
{
  try
  {
    this.mStore.remove(pKey);
    $("#" + pKey).remove();
  }
  catch(e) { console.log("QHistory._removeRow: " + e); }
}
QHistory.prototype._addRow = function(pKey, pValue)
{
  var lBody = $("#qhistorybody");
  var lRow = $("<tr id=\"" + pKey + "\"/>").appendTo(lBody);
  lRow.append($("<td>" + pValue + "</td>"));
  lRow.mouseover(function() { $(this).addClass("highlighted"); });
  lRow.mouseout(function() { $(this).removeClass("highlighted"); });
  lRow.click(function() { $("#query").val(pValue); return false; });
  var lThis = this;
  lRow.bind(
    "contextmenu", null,
    function(_pEvent)
    {
      var _lMenu = new CtxMenu();
      _lMenu.addItem($("#menuitem_qh_setquery").text(), function() { $("#query").val(pValue); }, null, true);
      _lMenu.addItem($("#menuitem_qh_remove").text(), function() { lThis._removeRow(pKey); });
      _lMenu.start(_pEvent.pageX, _pEvent.pageY);
      return false;
    });
}
QHistory.prototype.recordQuery = function(pQuery)
{
  if (undefined == this.mStore)
    return;

  // If this query is already in the history, don't add it again.
  // Notes:
  //   There appears to be no way to interrupt this iteration.
  //   Managing efficiently a LRU with this kind of storage would require additional gymnastics.
  var lAlreadyThere = false;
  try
  {
    this._iterate(function(_pK, _pV) { if (_pV == pQuery) lAlreadyThere = true; });
    if (lAlreadyThere)
      return;

    // Store it.
    var lCacheKey = (parseInt(this.mStore.get('hist_lastkey') || "0") + 1).toString();
    this.mStore.set('hist_' + lCacheKey, pQuery);
    this.mStore.set('hist_lastkey', lCacheKey);

    // Add it to the table.
    this._addRow('hist_' + lCacheKey, pQuery);
  }
  catch(e) { console.log("QHistory.recordQuery: " + e); }
}
QHistory.prototype.clearHistory = function()
{
  if (!window.confirm("Clear the query history?"))
    return;
  var lThis = this;
  var lHistKeys = [];
  try
  {
    this._iterate(function(_pK, _pV) { lHistKeys.push(_pK); });
    $.each(lHistKeys, function(_pI, _pE) { lThis.mStore.remove(_pE); });
    lThis.mStore.remove('hist_lastkey');
    $("#qhistorybody").empty();
  }
  catch(e) { console.log("QHistory.clearHistory: " + e); }
}

/**
 * Tutorial.
 * Manages the tutorial window and its input line.
 */
function Tutorial()
{
  var lThis = this;
  var lExecuteLine =
    function()
    {
      function _stringify(__pWhat, __pQuoteStrings)
      {
        if (typeof(__pWhat) == "object")
        {
          if (__pWhat instanceof Array)
          {
            var __lR = [];
            for (var __i = 0; __i < __pWhat.length; __i++)
              __lR.push(_stringify(__pWhat[__i], __pQuoteStrings));
            var __lRt = __lR.join(",");
            if (__lRt.length > 100) { __lRt = __lR.join(",<br>"); }
            return "[" + __lRt + "]";
          }
          else if (__pWhat instanceof Date)
            return "'" + __pWhat.toString() + "'";
          else
          {
            var __lR = [];
            for (var __iP in __pWhat)
              __lR.push(__iP + ":" + _stringify(__pWhat[__iP], true));
            return "{" + __lR.join(",") + "}";
          }
        }
        else if (typeof(__pWhat) == "string" && __pQuoteStrings)
          return "'" + __pWhat + "'";
        return __pWhat;
      }
      function _onPathsqlResult(__pJson) { print(__pJson); }
      function _pushTutInstr(__pLine) { lThis.mHistory.append($("<p class='tutorial_instructions'>" + __pLine + "</p>")); }
      function print(__pWhat) { lThis.mHistory.append($("<p class='tutorial_result'>" + _stringify(__pWhat, false) + "</p>")); }
      function pathsql(__pSql)
      {
        // Log in the query history.
        // WARNING:
        //   This proves to be catastrophically slow, and is so detrimental to the
        //   performance of the tutorial that I decided to forget about it.
        // MV_CONTEXT.mQueryHistory.recordQuery(__pSql);

        var __lEvalResult = null;
        var __lOnPathsql = function(__pJson, __pD) { _onPathsqlResult(__pJson); __lEvalResult = __pJson; }

        // Note:
        //   It doesn't appear to be possible to rely on keep-alive for transactions, in all browsers.
        //   On the other hand, we would like to display the best performance possible (in the tutorial).
        //   Therefore, we provide this compromise, where operations of a transaction will not return any
        //   result synchronously.
        // Note:
        //   For the moment I'm not planning to use nested transactions in the tutorial,
        //   so I don't add complexity here to support them.
        if (undefined != lThis.mPendingTx)
        {
          lThis.mPendingTx.push(__pSql);
          if (__pSql.match(/\s*commit/i))
          {
            mv_batch_query(
              lThis.mPendingTx,
              new QResultHandler(
                function(__pJson, __pD){ lThis.mPendingTx = null; __lOnPathsql(__pJson, __pD); },
                function(__pError){ lThis.mPendingTx = null; print("error:" + __pError[0].responseText); }), {sync:true});
            return __lEvalResult;
          }
          else
            return {"note":"in the web console, results of operations in a transaction are returned upon commit"};
        }
        else if (__pSql.match(/\s*start\s*transaction/i))
        {
          lThis.mPendingTx = new Array();
          lThis.mPendingTx.push(__pSql);
          return {"note":"in the web console, results of operations in a transaction are returned upon commit"};
        }
        else
        {
          mv_query(mv_sanitize_semicolon(__pSql), new QResultHandler(__lOnPathsql, function(__pError){ print("error:" + __pError[0].responseText); }), {sync:true});
          return __lEvalResult;
        }
      }
      function q(__pSql) { return pathsql(__pSql); }
      function save(__pJson)
      {
        if (typeof(__pJson) != "object")
          { alert("This tutorial will only save objects (with named properties)."); return; }
        if (__pJson instanceof Array)
        {
          for (__i = 0; __i < __pJson.length; __i++)
            save(__pJson[__i]);
        }
        else
        {
          var __lQ = (undefined != __pJson.id) ? ("UPDATE @" + __pJson.id + " SET ") : "INSERT ";
          var __lArgs = []
          for (__iP in __pJson)
          {
            if (__iP == "id")
              continue;
            var __lV = __pJson[__iP];
            var __lArg = __iP + "=";
            switch (typeof(__lV))
            {
              case "boolean":
              case "number":
                __lArg += __lV;
                break;
              case "string":
                __lArg += "'" + escape(__lV) + "'";
                break;
              case "object":
                if (__lV instanceof Date)
                {
                  var __l2Digits = function(__pNum) { return (__pNum < 10 ? "0" : "") + __pNum; }
                  var __lDate2Str = function(__pDate) { return __pDate.getUTCFullYear().toString() + "-" + __l2Digits(1 + __pDate.getUTCMonth()) + "-" + __l2Digits(__pDate.getUTCDate()) + " " + __l2Digits(__pDate.getUTCHours()) + ":" + __l2Digits(__pDate.getUTCMinutes()) + ":" + __l2Digits(__pDate.getUTCSeconds()); }
                  __lArg += "TIMESTAMP'" + __lDate2Str(__lV) + "'";
                }
                else if (__lV instanceof Array)
                  __lArg += "{" + __lV.join(",") + "}"; // Review: very incomplete...
                else
                {
                  alert("This demo doesn't support the full range of object attributes, yet.");
                  __lArg = null;
                }
                break;
            }
            if (__lArg)
              __lArgs.push(__lArg);
          }
          __lQ = __lQ + __lArgs.join(",") + ";";
          __lRes = pathsql(__lQ);
          if (undefined == __pJson.id && __lRes.length > 0)
            __pJson.id = __lRes[0].id;
        }
      }
      function h()
      {
        $("#thetutorial #help div").each(function(_pI, _pE) { lThis.mHistory.append($("<p class='tutorial_help'>" + $(_pE).html() + "</p>")); });
      }
      function t()
      {
        $("#thetutorial #steps #step0 div").each(function(_pI, _pE) { _pushTutInstr($(_pE).html()); });
        lThis.mTutorialStep = 1;
      }
      function n()
      {
        var lNumSteps = $("#thetutorial #steps > div").size();
        if (lThis.mTutorialStep < lNumSteps)
        {
          lThis.mPendingTx = null; // Note: I need to figure out ASAP why mPendingTx is not always cleared properly on COMMIT (during the previous step); in the meantime, to eliminate the impact of this problem, I force-clear it when a new step starts.
          $("#thetutorial #steps #step" + lThis.mTutorialStep + " div").each(function(_pI, _pE) { _pushTutInstr($(_pE).html()); });
          if (lThis.mTutorialStep > 0)
          {
            var lQuickRunStep = lThis.mTutorialStep;
            var lQuickRunButton = $("<div class='tutorial_button_run'>paste &amp; run step " + lQuickRunStep + "</div>");
            lThis.mHistory.append(lQuickRunButton);
            lQuickRunButton.click(
              function()
              {
                lThis.mInput.val("");
                $("#thetutorial #steps #step" + lQuickRunStep + " .tutorial_step").each(
                  function(_pI, _pE) { lThis.mInput.val(lThis.mInput.val() + $(_pE).html().replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")); });
                lExecuteLine();
              });
          }
          lThis.mTutorialStep++;
        }
        else
          _pushTutInstr($("#thetutorial #restart").html());
      }
      function step(__pStep)
      {
        if (__pStep < 0)
          return;
        var lNumSteps = $("#thetutorial #steps > div").size();
        lThis.mTutorialStep = Math.min(__pStep, lNumSteps);
        n();
      }
      function next() { n(); }
      var _lStmt = lThis.mInput.val().replace(/var/, ""); // Review: should we support var?
      if (_lStmt == "t") _lStmt = "t()";
      else if (_lStmt == "n") _lStmt = "n()";
      else if (_lStmt == "h") _lStmt = "h()";
      else if (_lStmt == "next") _lStmt = "n()";
      lThis.mPushInput();
      lThis.mStmtHistory.push(_lStmt);
      lThis.mStmtHistoryCursor = null;
      eval(_lStmt);
      lThis.mScroll();
    }
  this.mPendingTx = null;
  this.mInput = $("#tutorial_input");
  this.mHistory = $("#tutorial_history");
  this.mStmtHistory = new Array();
  this.mStmtHistoryCursor = null;
  this.mOnKey =
    function(_pEvent)
    {
      if (13 == _pEvent.keyCode) { lExecuteLine(); return; }
      if (0 == _pEvent.which)
      {
        if (38 == _pEvent.keyCode) // up (prev stmt in history)
        {
          lThis.mStmtHistoryCursor = (undefined == lThis.mStmtHistoryCursor) ? lThis.mStmtHistory.length - 1 : Math.max(lThis.mStmtHistoryCursor - 1, 0);
          lThis.mInput.val(lThis.mStmtHistory[lThis.mStmtHistoryCursor]);
        }
        else if (40 == _pEvent.keyCode) // up (next stmt in history)
        {
          lThis.mStmtHistoryCursor = (undefined == lThis.mStmtHistoryCursor) ? lThis.mStmtHistory.length - 1 : Math.min(lThis.mStmtHistoryCursor + 1, lThis.mStmtHistory.length);
          lThis.mInput.val(lThis.mStmtHistoryCursor < lThis.mStmtHistory.length ? lThis.mStmtHistory[lThis.mStmtHistoryCursor] : "");
        }
      }
    } // if 0 == pEvent.which ... 38:up 40:down
  this.mInput.keypress(this.mOnKey);
  this.mPushInput = function() { lThis.mHistory.append($("<p class='tutorial_stmt'>&gt;" + lThis.mInput.val().replace(/<br>/g, "&lt;br&gt;") + "</p>")); lThis.mInput.val(''); }
  this.mScroll = function() { $("#tutorial_area").scrollTop(lThis.mHistory.height() + 2 * $("#tutorial_input").height() - $("#tutorial_area").height()); $("#tutorial_area").scrollLeft(0); }
  this.mTutorialStep = 0;
  $("#tutorial_area").click(function() { lThis.mInput.focus(); });
  $("#tab-tutorial").bind("activate_tab", function() { lThis.mInput.focus(); });
}

/**
 * GraphMap.
 * Manages the graph/map display.
 * A clique is a group of pins related by something, such as:
 * . pins that refer to each other via any property
 * . pins that refer to each other via a specific set of properties
 * . pins that belong to the same classes
 * In order for pagination to be meaningful, a pin that doesn't gain new refs should remain where it was.
 * For the moment, we only display homogeneous cliques (i.e. a pin belongs to only 1 clique).
 * TODO: More filtering options.
    - show only desired types of objects (e.g. people, not cars)
      -> a series of checkboxes (maybe directly in the legend)
      -> as a big bitarray, with hovering telling what it is :)
    - traverse only specified relationships (e.g. friends, not parents)
    - clique threshold: if only connected by <x, not in
 * TODO: actual algo from Mark... plus generate 'real' cliques in sample material.
 * TODO: Will always only render the query result (top filter).
 * TODO: Will always draw everything; may accumulate layout info in a tmp db.
 * TODO: Will allow to specify classes/props as additional criteria for 'closeness';
 *       if classes are specified for closeness, walk by classes first
 * TODO: Will color by classes...
 */
function gm_has(pArray, pO) { if (undefined == pArray) return; for (var i = 0; i < pArray.length; i++) if (pArray[i] == pO) return true; return false; }
function gm_removeFrom(pArray, pO) { if (undefined == pArray) return; for (var i = 0; i < pArray.length; i++) if (pArray[i] == pO) { pArray.splice(i, 1); return; } }
function gm_quantizePos(pX, pY, pGrid) { return "" + ((pX / pGrid) >> 0) + "," + ((pY / pGrid) >> 0); }
function gm_LayoutCtx(pQuery, pUIUpdater)
{
  // TODO: This will gradually become an interface/caching layer to the layout db.
  // TODO: For the moment, I want to observe and learn what I'll need.
  var lThis = this;
  this.query = pQuery; // The actual query defining the root domain. TODO: option to clip to this set...
  this.ui_updater = pUIUpdater; // A function allowing to progressively update the UI as we progress through pagination.
  this.processed = {}; // PIDs of all pins processed so far.
  this.cliques_byref = []; // Cliques of pins referencing each other via any property (no single-pin clique).
  this.solitaires = {}; // Single pins (not in any clique yet).
  this.backrefs = {}; // To store/retrieve who's pointing to me.
  this.hasClique = function(_pClique) { for (var _iC = 0; _iC < lThis.cliques_byref.length; _iC++) if (lThis.cliques_byref[_iC] == _pClique) return true; return false; }
}
gm_LayoutCtx.CLIQUE_RADIUS = 1000.0; // Each clique will be contained within a circle of 100.0 units of radius.
gm_LayoutCtx.QUANTIZE_GRID = 10; // For 2d retrieval, objects will be mapped by position on a grid of 5-units squares.
function gm_LayoutNodeInfo(pPin, pLayoutCtx)
{
  var lTrimPid = function(_pPid) { return _pPid.replace(/^0+/, ""); }
  var lPid = lTrimPid(pPin.id);
  var lDoExtractImmediateRefs =
    function()
    {
      var _lRefs = [];
      for (var _iProp in pPin)
      {
        if (typeof(pPin[_iProp]) == "object" && "$ref" in pPin[_iProp])
          _lRefs.push(lTrimPid(pPin[_iProp]["$ref"]));
        else if (typeof(pPin[_iProp]) == "object")
        {
          for (var _iElm in pPin[_iProp])
          {
            if (typeof(pPin[_iProp][_iElm]) == "object" && "$ref" in pPin[_iProp][_iElm])
              _lRefs.push(lTrimPid(pPin[_iProp][_iElm]["$ref"]));
          }
        }
      }
      return _lRefs;
    }
  var lRegisterBackrefs =
    function(_pRefs)
    {
      for (var _iR = 0; _iR < _pRefs.length; _iR++)
      {
        var _lTarget = _pRefs[_iR];
        if (_lTarget in pLayoutCtx.backrefs) pLayoutCtx.backrefs[_lTarget].push(lPid);
        else pLayoutCtx.backrefs[_lTarget] = [lPid];
      }
    }
  var lThis = this;
  this.pin = pPin;
  this.id = lPid;
  this.position = null; // {x:_, y:_, numrefs:_} where (x,y) are relative to the clique in logical cs, and numrefs is a snapshot of the number of backrefs at last evaluation of (x,y).
  this.fwrefs = lDoExtractImmediateRefs(pPin);
  this.clique = null; // at least for now, a node will belong to only 1 clique at a time (single level of cliques per display).
  this.numrefs_cache = null;
  this.numrefs_eval = function() { lThis.numrefs_cache = lThis.fwrefs.length + (lThis.id in pLayoutCtx.backrefs ? pLayoutCtx.backrefs[lThis.id].length : 0); }
  this.setPosition = function(_pX, _pY) { lThis.position = {x:_pX, y:_pY, numrefs:lThis.numrefs_cache}; }
  this.resetPosition = function() { lThis.position = null; }
  lRegisterBackrefs(this.fwrefs);
}
function gm_Clique(pLayoutCtx)
{
  var lThis = this;
  var lDebug = false;
  this.data = {}
  this.add =
    function(_pNodeInfo)
    {
      if (lDebug)
      {
        var _l2 = [];
        for (var _i in lThis.data)
          _l2.push("@" + _i);
        console.log("added @" + _pNodeInfo.id + " to " + _l2.join(","));
      }
      lThis.data[_pNodeInfo.id] = _pNodeInfo;
      _pNodeInfo.clique = lThis;
    }
  this.merge =
    function(_pOtherClique)
    {
      if (_pOtherClique == lThis)
        return;
      if (lDebug)
      { 
        var _l1 = [];
        for (var _i in _pOtherClique.data)
          _l1.push("@" + _i);
        var _l2 = [];
        for (var _i in lThis.data)
          _l2.push("@" + _i);
        console.log("merged " + _l1.join(",") + " with " + _l2.join(","));
      }
      for (var _iN in _pOtherClique.data)
        lThis.add(_pOtherClique.data[_iN]);
      gm_removeFrom(pLayoutCtx.cliques_byref, _pOtherClique);
    }
  pLayoutCtx.cliques_byref.push(this);
}
function gm_InstrSeq()
{
  var iSubStep = 0;
  var lSubSteps = new Array();
  this.next = function() { iSubStep++; if (iSubStep < lSubSteps.length) lSubSteps[iSubStep](); }
  this.push = function(_pSubStep) { lSubSteps.push(_pSubStep); }
  this.start = function() { iSubStep = 0; lSubSteps[iSubStep](); }
  this.curstep = function() { return iSubStep; }
}
function gm_PageByPage(pQueryStr, pPageSize, pHandler, pUserData)
{
  var lAbort = false;
  var lOnCount =
    function(_pJson)
    {
      var _lPaginationCtx = new Object();
      _lPaginationCtx.mNumPins = parseInt(_pJson);
      _lPaginationCtx.mOffset = 0;
      var _lOnPage =
        function(__pJson, __pUserData)
        {
          if (undefined == __pJson) { return; }
          pHandler(__pJson, pUserData);
          __pUserData.mOffset += __pJson.length;
          if (__pUserData.mOffset < __pUserData.mNumPins && !lAbort)
            { setTimeout(function(){mv_query(pQueryStr, new QResultHandler(_lOnPage, null, __pUserData), {limit:pPageSize, offset:__pUserData.mOffset})}, 20); }
        }
      mv_query(pQueryStr, new QResultHandler(_lOnPage, null, _lPaginationCtx), {limit:pPageSize, offset:_lPaginationCtx.mOffset});
    }
  mv_query(pQueryStr, new QResultHandler(lOnCount, null, null), {countonly:true});
  this.abort = function() { lAbort = true; }
}
function gm_LayoutEngine()
{
  var lThis = this;
  var lPbP = null; // For interruptibility.
  var lMergeReferers =
    function(_pReferers, _pLayoutCtx)
    {
      var _lFirstInfoReferer = _pLayoutCtx.processed[_pReferers[0]];
      for (var _iR = 1; _iR < _pReferers.length; _iR++)
        _lFirstInfoReferer.clique.merge(_pLayoutCtx.processed[_pReferers[_iR]].clique);
    }
  var lBindLayoutInfo =
    function(_pPin, _pLayoutCtx)
    {
      // Use trimmed-down PIDs (no leading 0s).
      var _lPid = _pPin.id.replace(/^0+/, "");

      // If this pin was already processed...
      if (_lPid in _pLayoutCtx.processed)
      {
        // It may mean that we just discovered a pin pointing to it
        // (which by now should already be registered in _pLayoutCtx.backrefs).
        if (_lPid in _pLayoutCtx.backrefs)
        {
          // If the pin being pointed to was a solitaire, it no longer is.
          // Note: If a pin is pointing to another pin, it necessarily already has a clique (i.e. not solitaire).
          // Note: Many existing cliques may be pointing to this solitaire... must merge all.
          var _lInfo = _pLayoutCtx.processed[_lPid];
          var _lReferers = _pLayoutCtx.backrefs[_lPid];
          var _lFirstInfoReferer = _pLayoutCtx.processed[_lReferers[0]];
          if ((_lInfo.clique == _pLayoutCtx.solitaires) && (_lPid in _pLayoutCtx.solitaires))
          {
            delete _pLayoutCtx.solitaires[_lPid];
            _lFirstInfoReferer.clique.add(_lInfo);
            lMergeReferers(_lReferers, _pLayoutCtx);
          }
          // If it belonged to a clique, it's time to merge cliques.
          else if (_lFirstInfoReferer.clique != _lInfo.clique && _pLayoutCtx.hasClique(_lInfo.clique))
          {
            _lFirstInfoReferer.clique.merge(_lInfo.clique);
            lMergeReferers(_lReferers, _pLayoutCtx);
          }
        }
        return null;
      }

      // This is a new pin; register it as such; scan its outward references.
      var _lInfo = new gm_LayoutNodeInfo(_pPin, _pLayoutCtx);
      _pLayoutCtx.processed[_lPid] = _lInfo;

      // Determine its clique.
      if (_lPid in _pLayoutCtx.backrefs)
      {
        // Some other pin is pointing to it, so it belongs to that clique (may involve merging multiple cliques).
        var _lReferers = _pLayoutCtx.backrefs[_lPid];
        var _lFirstInfoReferer = _pLayoutCtx.processed[_lReferers[0]];
        _lFirstInfoReferer.clique.add(_lInfo);
        lMergeReferers(_lReferers, _pLayoutCtx);
      }
      else if (0 == _lInfo.fwrefs.length)
      {
        // It points to nothing and nothing points to it so far, so it's a solitaire.
        _pLayoutCtx.solitaires[_lPid] = _lInfo;
        _lInfo.clique = _pLayoutCtx.solitaires;
      }
      else
      {
        // It points to other pins, so at least for now, it's the beginning of a new clique.
        var _lNewClique = new gm_Clique(_pLayoutCtx);
        _lNewClique.add(_lInfo);
      }
      return _lInfo;
    }
  var lRecomputePositions =
    function(_pLayoutCtx)
    {
      var _lMaxRadius = gm_LayoutCtx.CLIQUE_RADIUS;
      var _lSimpleHashAngle = function(_pPidStr) { var _lH = 0; for (var _i = 0; _i < _pPidStr.length; _i++) { _lH = (27 * _lH + 35 * _pPidStr.charCodeAt(_i)) % 100 ; } return _lH / 100; }
      var _lSimpleHashDist = function(_pPidStr) { var _lH = 0; for (var _i = 0; _i < _pPidStr.length; _i++) { _lH = (37 * _lH + 19 * _pPidStr.charCodeAt(_i)) % _lMaxRadius ; } return _lH; }

      // Solitaires.
      for (var _iPid in _pLayoutCtx.solitaires)
      {
        var _lI = _pLayoutCtx.solitaires[_iPid];
        if (undefined != _lI.position)
          continue;
        var _lDistance = _lSimpleHashDist(_iPid);
        var _lAngle = 2 * Math.PI * _lSimpleHashAngle(_iPid);
        _lI.setPosition(_lDistance * Math.cos(_lAngle), _lDistance * Math.sin(_lAngle));
      }

      // Cliques.
      for (var _iC = 0; _iC < _pLayoutCtx.cliques_byref.length; _iC++)
      {
        var _lClique = _pLayoutCtx.cliques_byref[_iC];
        
        // In a clique, put the pins with most relationships closer to the center;
        // don't move pins that have no more refs than at their last evaluation.
        var _lRemaining = []
        for (var _iPid in _lClique.data)
        {
          var _lI = _lClique.data[_iPid];
          _lRemaining.push(_lI);
          _lI.numrefs_eval();
          if (undefined != _lI.position && _lI.position.numrefs < _lI.numrefs_cache)
            _lI.resetPosition();
        }
        _lRemaining.sort(function(__a, __b) { return __a.numrefs_cache - __b.numrefs_cache; });

        // Starting from the most 'friendly' downward, locate at a predictable distance from the center,
        // but at a pseudo-random angle.
        while (_lRemaining.length > 0)
        {
          var _lR = _lRemaining.pop();
          if (undefined != _lR.position)
            continue;
          var _lDistance = (_lMaxRadius / _lR.numrefs_cache);
          var _lAngle = 2 * Math.PI * _lSimpleHashAngle(_lR.id);
          _lR.setPosition(_lDistance * Math.cos(_lAngle), _lDistance * Math.sin(_lAngle));
        }
      }
    }
  var lRequestRefs =
    function(_pSS, _pRefs, _pOnResults, _pLayoutCtx)
    {
      _pSS.push(
        function()
        {
          mv_query(
            "SELECT * FROM {" + _pRefs.join(",") + "}",
             new QResultHandler(function(__pJson) { _pOnResults(__pJson, _pLayoutCtx); _pSS.next(); }, null, null));
        });
    }
  var lOnPage =
    function(_pJson, _pLayoutCtx)
    {
      if (undefined == _pJson) return;

      // First, scan references and bind layout infos for all new objects.
      var _lNewInfos = [];
      for (var _iPin = 0; _iPin < _pJson.length; _iPin++)
      {
        var _lI = lBindLayoutInfo(_pJson[_iPin], _pLayoutCtx);
        if (undefined != _lI)
        {
          for (var _iR = 0; _iR < _lI.fwrefs.length; _iR++)
            _lNewInfos.push("@" + _lI.fwrefs[_iR]);
        }
      }

      // Second, walk all possible new paths generated by these references (bfs).
      var _lSS = new gm_InstrSeq();
      while (_lNewInfos.length > 0)
        lRequestRefs(_lSS, _lNewInfos.splice(0, 200), lOnPage, _pLayoutCtx);

      // Once all structural aspects of the page will be dealt with, attribute positions and refresh.
      _lSS.push(function() { lRecomputePositions(_pLayoutCtx); _pLayoutCtx.ui_updater(); });
      _lSS.start();
    }
  this.doLayout =
    function(_pLayoutCtx)
    {
      // On a page by page basis (streaming), perform the layout and refresh along the way.
      if (undefined != lPbP) { lPbP.abort(); }
      lPbP = new gm_PageByPage(_pLayoutCtx.query, 200, lOnPage, _pLayoutCtx);
    }
}
function GraphMap()
{
  var lThis = this;
  var l2dCtx = document.getElementById("map_area").getContext("2d");
  var lVPHeight = $("#map_area").height();
  var lPan = {x:0, y:0}, lZoom = lVPHeight / (2 * gm_LayoutCtx.CLIQUE_RADIUS);
  var lLayoutEngine = new gm_LayoutEngine();
  var lLayoutCtx = null;
  var lBypos = {};
  var lDoDraw = // The rendering engine.
    function()
    {
      // We assume, as seems to be the case, that
      // browsers take care of double-buffering upon return
      // from this function.  Should this need to be improved,
      // see: http://stackoverflow.com/questions/2795269/does-html5-canvas-support-double-buffering.
      
      // Reset transfos and background.
      l2dCtx.setTransform(1, 0, 0, 1, 0, 0);
      l2dCtx.fillStyle = "#e4e4e4";
      l2dCtx.fillRect(0, 0, l2dCtx.canvas.width, l2dCtx.canvas.height);
      if (undefined == lLayoutCtx)
        return;

      // Apply current pan&zoom.
      l2dCtx.scale(lZoom, lZoom);
      l2dCtx.translate(lPan.x, lPan.y);

      // Draw a shadow behind each clique (+ solitaires).
      var _lCX = 0, _iC;
      l2dCtx.fillStyle = "#eaeaea";
      for (_iC = 0; _iC < 1 + lLayoutCtx.cliques_byref.length; _iC++, _lCX += 2 * gm_LayoutCtx.CLIQUE_RADIUS)
      {
        var _lClique = lLayoutCtx.cliques_byref[_iC];
        l2dCtx.beginPath();
        l2dCtx.arc(_lCX, gm_LayoutCtx.CLIQUE_RADIUS, gm_LayoutCtx.CLIQUE_RADIUS, 0, 2 * Math.PI, false);
        l2dCtx.closePath();
        l2dCtx.fill();
      }

      // Set some general attributes.
      l2dCtx.strokeStyle = "#d0caed";
      l2dCtx.fillStyle = "#444";
      l2dCtx.lineWidth = 3;

      // Draw edges.
      for (_iC = 0, _lCX = 0; _iC < lLayoutCtx.cliques_byref.length; _iC++, _lCX += 2 * gm_LayoutCtx.CLIQUE_RADIUS)
      {
        var _lClique = lLayoutCtx.cliques_byref[_iC];
        for (var _iPid in _lClique.data)
        {
          var _lI = _lClique.data[_iPid];
          if (undefined == _lI.position)
            continue;
          for (var _iRef = 0; _iRef < _lI.fwrefs.length; _iRef++)
          {
            var _lITo = lLayoutCtx.processed[_lI.fwrefs[_iRef]];
            if (undefined == _lITo.position)
              continue;
            l2dCtx.beginPath();
            l2dCtx.moveTo(_lCX + _lI.position.x, gm_LayoutCtx.CLIQUE_RADIUS + _lI.position.y);
            l2dCtx.lineTo(_lCX + _lITo.position.x, gm_LayoutCtx.CLIQUE_RADIUS + _lITo.position.y);
            l2dCtx.closePath();
            l2dCtx.stroke();
          }
        }
      }

      // Draw vertices.
      // TODO: add a coloring phase to the layout, and then here use either a default color, or colors representing the classes (pie slices).
      var _lDrawVertex =
        function(__pInfo, __pXOffset)
        {
          if (undefined == __pInfo.position)
            return;
          var __lX = __pXOffset + __pInfo.position.x;
          var __lY = gm_LayoutCtx.CLIQUE_RADIUS + __pInfo.position.y;
          var __lQpos = gm_quantizePos(__lX, __lY, gm_LayoutCtx.QUANTIZE_GRID);
          if (__lQpos in lBypos) { if (!gm_has(lBypos[__lQpos], __pInfo)) lBypos[__lQpos].push(__pInfo); } else lBypos[__lQpos] = [__pInfo];
          l2dCtx.beginPath();
          l2dCtx.arc(__lX, __lY, 5, 0, 2 * Math.PI, false);
          l2dCtx.closePath();
          l2dCtx.fill();
          l2dCtx.stroke();
          l2dCtx.fillText("@" + __pInfo.id /*+ "[" + __lQpos + "]"*/, __lX + 5, __lY + 2);
        }
      for (_iC = 0, _lCX = 0; _iC < lLayoutCtx.cliques_byref.length; _iC++, _lCX += 2 * gm_LayoutCtx.CLIQUE_RADIUS)
      {
        var _lClique = lLayoutCtx.cliques_byref[_iC];
        for (var _iPid in _lClique.data)
          _lDrawVertex(_lClique.data[_iPid], _lCX);
      }
      for (var _iPid in lLayoutCtx.solitaires)
        _lDrawVertex(lLayoutCtx.solitaires[_iPid], _lCX);

      // Draw legend etc.
      l2dCtx.setTransform(1, 0, 0, 1, 0, 0);
      l2dCtx.fillStyle = "#444";
      l2dCtx.lineWidth = 1;
      l2dCtx.fillText("pan:", 5, lVPHeight - 42);
      l2dCtx.fillText("zoom:", 5, lVPHeight - 22);
      l2dCtx.fillText("classes:", 5, lVPHeight - 2);
      l2dCtx.fillStyle = "#666";
      l2dCtx.strokeStyle = "#666";
      l2dCtx.fillText("click&drag", 50, lVPHeight - 42);
      l2dCtx.fillText("z + click&drag", 50, lVPHeight - 22);
      if (undefined != MV_CONTEXT.mClasses)
      {
        l2dCtx.fillStyle = "#0a0";
        for (var _iC = 0; _iC < MV_CONTEXT.mClasses.length; _iC++)
        {
          l2dCtx.fillRect(50 + _iC * 15, lVPHeight - 15 - 2, 15, 15);
          l2dCtx.strokeRect(50 + _iC * 15, lVPHeight - 15 - 2, 15, 15);
        }
      }
    }
  var lDoLayout =
    function()
    {
      lLayoutCtx = new gm_LayoutCtx(mv_sanitize_semicolon($("#map_query").val()), lDoDraw);
      lLayoutEngine.doLayout(lLayoutCtx);
      lBypos = {};
    }

  // Pan & Zoom.
  var lButtonDown = false, lZoomKeyDown = false;
  var lAnchorPoint = {x:0, y:0}, lDynAnchorPoint = {x:0, y:0}, lLastPoint = {x:0, y:0};
  var lMouseMove =
    function(e)
    {
      lLastPoint.x = e.pageX; lLastPoint.y = e.pageY;
      if (lButtonDown)
      {
        if (lZoomKeyDown) 
        { 
          var _lOffset = $("#map_area").offset();
          var _lAP = {x:lAnchorPoint.x - _lOffset.left, y:lAnchorPoint.y - _lOffset.top};
          var _lLog = {x:_lAP.x / lZoom - lPan.x, y:_lAP.y / lZoom - lPan.y};
          lZoom = lZoom + lZoom * (0.2 * (lDynAnchorPoint.y < lLastPoint.y ? -1 : 1)); 
          lPan.x = (_lAP.x / lZoom) - _lLog.x; // ecr = (log + pan) * zoom -> pan = ecr/zoom - log
          lPan.y = (_lAP.y / lZoom) - _lLog.y;
        }
        else
        {
          lPan.x += (lLastPoint.x - lDynAnchorPoint.x) / lZoom;
          lPan.y += (lLastPoint.y - lDynAnchorPoint.y) / lZoom;
        }
        lDynAnchorPoint.x = lLastPoint.x;
        lDynAnchorPoint.y = lLastPoint.y;
        lDoDraw();
      }
      else if (undefined != lLayoutCtx && undefined != MV_CONTEXT.mClasses)
      {
        var _lOffset = $("#map_area").offset();
        var _lNLP = {x:lLastPoint.x - _lOffset.left, y:lLastPoint.y - _lOffset.top};
        if (_lNLP.x >= 50 && _lNLP.x < 50 + 15 * MV_CONTEXT.mClasses.length && _lNLP.y >= lVPHeight - 15 && _lNLP.y <= lVPHeight - 2)
        {
          var _lClassIndex = Math.floor((_lNLP.x - 50) / 15);
          if (_lClassIndex >= 0 && _lClassIndex < MV_CONTEXT.mClasses.length)
            bindTooltip($("#map_area"), MV_CONTEXT.mClasses[_lClassIndex]["afy:classID"], {left:lLastPoint.x, top:lLastPoint.y - 40}, {once:true, start:0, end:500, offy:-15});
        }
          
        /*
        var _lOffset = $("#map_area").offset();
        var _lQpos = gm_quantizePos(((lLastPoint.x - _lOffset.left + gm_LayoutCtx.QUANTIZE_GRID) / lZoom - lPan.x), ((lLastPoint.y - _lOffset.top + gm_LayoutCtx.QUANTIZE_GRID) / lZoom - lPan.y), gm_LayoutCtx.QUANTIZE_GRID);
        $("#map_status").text("at: " + _lQpos);
        if (_lQpos in lBypos)
        {
          var _lIds = [];
          for (var _iP = 0; _iP < lBypos[_lQpos].length; _iP++)
            _lIds.push("@" + lBypos[_lQpos][_iP].id);
          bindTooltip($("#map_area"), _lIds.join(","), {left:lLastPoint.x, top:lLastPoint.y}, {start:100, stop:500, once:true});
        }
        */
      }
    }
  $("#map_area").mousemove(lMouseMove);
  $("#map_area").mousedown(function(e) { lButtonDown = true; lDynAnchorPoint.x = lAnchorPoint.x = lLastPoint.x; lDynAnchorPoint.y = lAnchorPoint.y = lLastPoint.y; });
  $("#map_area").mouseup(function() { lButtonDown = false; });
  $("#map_area").mouseout(function() { lButtonDown = false; });
  $("#map_area").mouseleave(function() { lButtonDown = false; });
  window.addEventListener('keydown', function(e) { if (e.which == 90) lZoomKeyDown = true; }, true);
  window.addEventListener('keyup', function() { lZoomKeyDown = false; }, true);

  // Other interactions.
  $("#map_query").keypress(function(e) { if (13 == e.keyCode) { lDoLayout(); lDoDraw(); } return true; });
  $("#map_querygo").click(function() { lDoLayout(); lDoDraw(); return false; });
  $("#tab-map").bind("activate_tab", function() { populate_classes(); lDoDraw(); });

  // Initialize the canvas's dimensions (critical for rendering quality).
  $("#map_area").attr("width", $("#map_area").width());
  $("#map_area").attr("height", $("#map_area").height());
}

/**
 * Base64 helper.
 */
function base64_encode(data)
{
  if (!data) { return data; }
  var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc = "", tmp_arr = [];
  do
  {
    o1 = data.charCodeAt(i++);
    o2 = data.charCodeAt(i++);
    o3 = data.charCodeAt(i++);
    bits = o1 << 16 | o2 << 8 | o3;
    h1 = bits >> 18 & 0x3f;
    h2 = bits >> 12 & 0x3f;
    h3 = bits >> 6 & 0x3f;
    h4 = bits & 0x3f;
    tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
  } while (i < data.length);
  enc = tmp_arr.join('');
  var r = data.length % 3;
  return (r ? enc.slice(0, r - 3) : enc) + '==='.slice(r || 3);
}

/**
 * Document entry point (by callback).
 */
$(document).ready(
  function() {
    // Home/logo button.
    $("#gh_logo_img").hover(function() { $(this).addClass("logo-highlighted"); }, function() { $(this).removeClass("logo-highlighted"); });
    $("#gh_logo_img").click(function() { window.location.href = 'http://' + location.hostname + ":" + location.port; });
    // Setup a client-side persistent memory.
    MV_CONTEXT.mUIStore = new Persist.Store("mvStore Console Persistence");
    if (undefined != MV_CONTEXT.mUIStore)
    {
      var lLastStoreIdent = MV_CONTEXT.mUIStore.get('laststoreident');
      if (undefined != lLastStoreIdent)
        $("#storeident").val(lLastStoreIdent);
      var lLastStorePw = MV_CONTEXT.mUIStore.get('laststorepw');
      if (undefined != lLastStorePw)
        $("#storepw").val(lLastStorePw);
    }
    // Setup the tutorial.
    new Tutorial();
    // Setup the graph/map.
    new GraphMap();
    // Setup the batching UI.
    new BatchingSQL();
    // Setup tab-dependent aspects of the basic console.
    // Note:
    //   For the moment, for simplicity, we refresh classes everytime we come back from another tab
    //   (where classes may have been created).
    // Note:
    //   This also allows to land on the tutorial page without emitting any query to the store upfront,
    //   which is nice in a setup where the front-end is hosted in a separate environment.
    $("#tab-basic").bind("activate_tab", function() { populate_classes(); $("#query").focus(); });
    // Setup the main navigational tab system.
    // Note: We set this up after the actual tabs, in order for them to receive the initial 'activate_tab'.
    MV_CONTEXT.mNavTabs = new NavTabs();    
    // Setup the basic tooltips.
    bindAutomaticTooltips();
    // Setup static context menus.
    bindStaticCtxMenus();
    // Setup the persistent cache for the query history.
    MV_CONTEXT.mQueryHistory = new QHistory($("#query_history"), MV_CONTEXT.mUIStore);
    // Setup the initial query string, if one was specified (used for links from doc to console).
    var lInitialQ = location.href.match(/query\=(.*?)((&.*)|(#.*)|\0)?$/i);
    if (undefined != lInitialQ && lInitialQ.length > 0)
      $("#query").val(unescape(lInitialQ[1]).replace(/\+/g, " "));
    var lInitialStoreId = location.href.match(/storeid\=(.*?)((&.*)|(#.*)|\0)?$/i);
    if (undefined != lInitialStoreId && lInitialStoreId.length > 0)
    {
      $("#storeident").val(unescape(lInitialStoreId[1]));
      $("#storepw").val("");
    }
    // UI callback for query form.
    $("#form").submit(function() {
      var lResultList = $("#result_table");
      lResultList.html("loading...");
      if ($("#result_pin pre").size() > 0) // If the contents of the #result_pin represent an error report from a previous query, clear it now; otherwise, let the contents stay there.
        $("#result_pin").empty(); 
      var lCurClassName = $("#classes option:selected").val();
      var lQueryStr = mv_sanitize_semicolon($("#query").val());
      MV_CONTEXT.mLastQueriedClassName = (lQueryStr.indexOf(mv_without_qname(lCurClassName)) >= 0) ? lCurClassName : null;
      if ($("#querytype option:selected").val() == "query" && null == lQueryStr.match(/select\s*count/i))
      {
        if (null != MV_CONTEXT.mLastQResult)
          { MV_CONTEXT.mLastQResult.mAborted = true; }
        lResultList.empty();
        MV_CONTEXT.mLastQResult = new QResultTable(lResultList, MV_CONTEXT.mLastQueriedClassName);
        MV_CONTEXT.mLastQResult.populate(lQueryStr);
        MV_CONTEXT.mQueryHistory.recordQuery(lQueryStr);
      }
      else
      {
        var lQuery = "query=" + mv_escape_with_plus(mv_with_qname_prefixes(lQueryStr)) + "&type=" + $("#querytype option:selected").val();
        $.ajax({
          type: "POST",
          url: DB_ROOT,
          dataType: "text",
          timeout: 10000,
          cache: false,
          global: false,
          data: lQuery,
          complete: function (e, xhr, s) {
            $("#result_table").html(hqbr(lQueryStr + "\n\n" + e.responseText + "\n" + xhr));
          },
          beforeSend : function(req) {
            req.setRequestHeader('Connection', 'Keep-Alive');
            var lStoreIdent = $("#storeident").val();
            var lStorePw = $("#storepw").val();
            if (lStoreIdent.length > 0) { req.setRequestHeader('Authorization', "Basic " + base64_encode(lStoreIdent + ":" + lStorePw)); }
          }
        });
      }
      return false;
    });
    // UI callbacks for interactions.
    $("#classes").change(on_class_change);
    $("#classes").dblclick(on_class_dblclick);
    $("#class_properties").change(on_cprop_change);
    $("#class_properties").dblclick(on_cprop_dblclick);
    // Review:
    //   For non-existing (new) stores, the policy used below is not ideal
    //   because if the user intends to create a password-protected store,
    //   he will have to specify the password first (otherwise populate_classes()
    //   will end up creating a store with whatever old [or nil] password was in #storepw).
    //   However, the console is primarily intended for navigation, and password-protected
    //   stores would be marginal in early exploratory experiments done in the console,
    //   so for the moment I prefer not to invest any time improving this.
    $("#storeident").change(function() { populate_classes(); if (undefined != MV_CONTEXT.mUIStore) { MV_CONTEXT.mUIStore.set('laststoreident', $("#storeident").val()); } });
    $("#storepw").change(function() { populate_classes(); if (undefined != MV_CONTEXT.mUIStore) { MV_CONTEXT.mUIStore.set('laststorepw', $("#storepw").val()); } });
  }
);

/**
 * String manips.
 */
function hq(s) {return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function hqbr(s) {return hq(s).replace(/\n/g,"<br/>").replace(/ /g,"&nbsp;");}

/**
 * MV query helpers.
 */
function mv_with_qname(pRawName)
{
  var lNewProp = null;
  var lLastSlash = (undefined != pRawName) ? pRawName.lastIndexOf("/") : -1;
  if (lLastSlash < 0)
    { return pRawName; }
  var lPrefix = pRawName.substr(0, lLastSlash);
  var lSuffix = pRawName.substr(lLastSlash + 1);
  if (lPrefix in MV_CONTEXT.mPrefix2QName)
    { return MV_CONTEXT.mPrefix2QName[lPrefix] + ":" + lSuffix; }
  else
  {
    var lNumQNames = 0;
    for (iQN in MV_CONTEXT.mPrefix2QName) { if (MV_CONTEXT.mPrefix2QName.hasOwnProperty(iQN)) lNumQNames++; }
    var lNewQName = "qn" + lNumQNames;
    MV_CONTEXT.mPrefix2QName[lPrefix] = lNewQName;
    MV_CONTEXT.mQName2Prefix[lNewQName] = lPrefix;
    MV_CONTEXT.mQNamesDirty = true;
    setTimeout(update_qnames_ui, 2000);
    return lNewQName + ":" + lSuffix;
  }
}
function mv_without_qname(pRawName)
{
  if (null == pRawName || undefined == pRawName)
    { return null; }
  var lColon = pRawName.indexOf(":");
  if (lColon < 0)
    { return pRawName; }
  var lQName = pRawName.substr(0, lColon);
  var lSuffix = pRawName.substr(lColon + 1);
  if (lQName in MV_CONTEXT.mQName2Prefix)
    { return MV_CONTEXT.mQName2Prefix[lQName] + "/" + lSuffix; }
  return pRawName;
}
function mv_with_qname_prefixes(pQueryStr)
{
  var lAlreadyDefined = {'http':1, 'afy':1};
  {
    var lAlreadyDefinedPattern = /PREFIX\s*(\w*)\:/gi;
    var lAD;
    while (undefined != (lAD = lAlreadyDefinedPattern.exec(pQueryStr)))
      lAlreadyDefined[lAD[1].toLocaleLowerCase()] = 1;
  }
  var lToDefine = {};
  {
    var lToDefinePattern = /\b(\w*)\:/g;
    var lTD;
    while (undefined != (lTD = lToDefinePattern.exec(pQueryStr)))
    {
      var lPrefix = lTD[1].toLocaleLowerCase();
      if (lPrefix in lAlreadyDefined)
        continue;
      if (!isNaN(Number(lPrefix)))
        continue;
      if (lPrefix in MV_CONTEXT.mQName2Prefix)
        lToDefine[lPrefix] = MV_CONTEXT.mQName2Prefix[lPrefix];
      else
        alert("Unknown prefix: " + lPrefix);
    }
  }
  var lProlog = "";
  for (var iP in lToDefine)
    { lProlog = lProlog + "PREFIX " + iP + ": '" + lToDefine[iP] + "' "; }
  return lProlog + pQueryStr;
}
function mv_sanitize_json_result(pResultStr)
{
  var lTransform =
    function(_pJsonRaw)
    {
      if (typeof(_pJsonRaw) == "number" || typeof(_pJsonRaw) == "boolean" || typeof(_pJsonRaw) == "string")
        return _pJsonRaw;
      if (typeof(_pJsonRaw) != "object")
        { alert("Unexpected type: " + typeof(_pJsonRaw)); return _pJsonRaw; }
      if (_pJsonRaw instanceof Array)
      {
        var _lNewArray = new Array();
        for (var _iElm = 0; _iElm < _pJsonRaw.length; _iElm++)
          _lNewArray.push(lTransform(_pJsonRaw[_iElm]));
        return _lNewArray;
      }
      var _lNewObj = new Object();
      for (var _iProp in _pJsonRaw)
      {
        var _lNewProp = mv_with_qname(_iProp);
        if (_iProp == _lNewProp)
          { _lNewObj[_iProp] = _pJsonRaw[_iProp]; continue; }
        _lNewObj[_lNewProp] = _pJsonRaw[_iProp];
      }
      return _lNewObj;
    };
  try
  {
    var lJsonRaw = $.parseJSON(pResultStr.replace(/\s+/g, " ")); // Note: for some reason chrome is more sensitive to those extra characters than other browsers.
    if (null == lJsonRaw) { return null; }
    return lTransform(lJsonRaw);
  } catch(e) { console.log("mv_sanitize_json_result: " + e); }
  return null;
}
function mv_sanitize_classname(pClassName)
{
  return (pClassName.charAt(0) != "\"" && pClassName.indexOf("/") > 0) ? ("\"" + pClassName + "\"") : pClassName;
}
function mv_sanitize_semicolon(pQ)
{
  // Remove the last semicolon, if any, to make sure the store recognizes single-instructions as such.
  if (undefined == pQ || 0 == pQ.length) return "";
  for (var _i = pQ.length - 1; _i >= 0; _i--)
  {
    switch (pQ.charAt(_i))
    {
      case ";": return pQ.substr(0, _i);
      case " ": case "\n": continue;
      default: return pQ;
    }
  }
  return "";
}
function mv_escape_with_plus(pStr)
{
  return escape(pStr.replace(/\+/g, "\+")).replace(/\+/g, "%2B"); // escape pStr, and preserve '+' signs (e.g. for {+} in path expressions; by default '+' is automatically interpreted as a space).
}

function QResultHandler(pOnSuccess, pOnError, pUserData) { this.mOnSuccess = pOnSuccess; this.mOnError = pOnError; this.mUserData = pUserData; }
QResultHandler.prototype.onsuccess = function(pJson, pSql) { if (this.mOnSuccess) this.mOnSuccess(pJson, this.mUserData, pSql); }
QResultHandler.prototype.onerror = function(pArgs, pSql)
{
  if (this.mOnError)
    this.mOnError(pArgs, this.mUserData, pSql);
  else
  {
    var lT = pSql + "\n" + pArgs[0].responseText;
    console.log(lT);
    lT = lT.replace(/\n/g, "<br>").replace(/\s/, "&nbsp;");
    $("#result_pin").empty(); $("#result_pin").append("<pre style='color:red'>" + lT + "</pre>");
  }
}
function mv_query(pSqlStr, pResultHandler, pOptions)
{
  if (null == pSqlStr || 0 == pSqlStr.length)
    { console.log("mv_query: invalid sql " + pSqlStr); pResultHandler.onerror(null, pSqlStr); return; }
  var lSqlStr = mv_with_qname_prefixes(pSqlStr);
  var lHasOption = function(_pOption) { return (undefined != pOptions && _pOption in pOptions); }
  $.ajax({
    type: "GET",
    url: DB_ROOT + "?q=" + mv_escape_with_plus(lSqlStr) + "&i=pathsql&o=json" + (lHasOption('countonly') ? "&type=count" : "") + (lHasOption('limit') ? ("&limit=" + pOptions.limit) : "") + (lHasOption('offset') ? ("&offset=" + pOptions.offset) : ""),
    dataType: "text", // Review: until mvStore returns 100% clean json...
    async: (lHasOption('sync') && pOptions.sync) ? false : true,
    timeout: (lHasOption('sync') && pOptions.sync) ? 10000 : null,
    cache: false,
    global: false,
    success: function(data) { /*alert(data);*/ pResultHandler.onsuccess(mv_sanitize_json_result(data), pSqlStr); },
    error: function() { pResultHandler.onerror(arguments, pSqlStr); },
    beforeSend : function(req) {
      if (!lHasOption('keepalive') || pOptions.keepalive) { req.setRequestHeader('Connection', 'Keep-Alive'); } // Note: This doesn't seem to guaranty that a whole multi-statement transaction (e.g. batching console) will run in a single connection; in firefox, it works if I configure network.http.max-persistent-connections-per-server=1 (via the about:config page).
      var lStoreIdent = $("#storeident").val();
      var lStorePw = $("#storepw").val();
      if (lStoreIdent.length > 0) { req.setRequestHeader('Authorization', "Basic " + base64_encode(lStoreIdent + ":" + lStorePw)); }
    }
  });
}
function mv_batch_query(pSqlStrArray, pResultHandler, pOptions)
{
  if (null == pSqlStrArray || 0 == pSqlStrArray.length)
    { console.log("mv_query: invalid sql batch"); pResultHandler.onerror(null, pSqlStrArray); return; }
  var lBody = "";
  for (var iStmt = 0; iStmt < pSqlStrArray.length; iStmt++)
  {
    lBody = lBody + mv_with_qname_prefixes(pSqlStrArray[iStmt]);
    var lChkSemicolon = pSqlStrArray[iStmt].match(/(.*)(;)(\s*)$/);
    if (iStmt < pSqlStrArray.length - 1 && (undefined == lChkSemicolon || undefined == lChkSemicolon[2]))
      lBody = lBody + ";";
  }
  var lHasOption = function(_pOption) { return (undefined != pOptions && _pOption in pOptions); }
  lBody = "q=" + mv_escape_with_plus(lBody) + (lHasOption('countonly') ? "&type=count" : "") + (lHasOption('limit') ? ("&limit=" + pOptions.limit) : "") + (lHasOption('offset') ? ("&offset=" + pOptions.offset) : "");
  $.ajax({
    type: "POST",
    data: lBody,
    url: DB_ROOT + "?i=pathsql&o=json",
    dataType: "text", // Review: until mvStore returns 100% clean json...
    async: (lHasOption('sync') && pOptions.sync) ? false : true,
    timeout: (lHasOption('sync') && pOptions.sync) ? 10000 : null,
    cache: false,
    global: false,
    success: function(data) { /*alert(data);*/ pResultHandler.onsuccess(mv_sanitize_json_result(data), pSqlStrArray); },
    error: function() { pResultHandler.onerror(arguments, pSqlStrArray); },
    beforeSend : function(req) {
      if (!lHasOption('keepalive') || pOptions.keepalive) { req.setRequestHeader('Connection', 'Keep-Alive'); } // Note: This doesn't seem to guaranty that a whole multi-statement transaction (e.g. batching console) will run in a single connection; in firefox, it works if I configure network.http.max-persistent-connections-per-server=1 (via the about:config page).
      var lStoreIdent = $("#storeident").val();
      var lStorePw = $("#storepw").val();
      if (lStoreIdent.length > 0) { req.setRequestHeader('Authorization', "Basic " + base64_encode(lStoreIdent + ":" + lStorePw)); }
    }
  });
}

/**
 * Classes/properties UI.
 */
function populate_classes()
{
  var lTruncateLeadingDot = function(_pStr) { return _pStr.charAt(0) == "." ? _pStr.substr(1) : _pStr; }
  var lOnSuccess = function(_pJson) {
    MV_CONTEXT.mClasses = _pJson;
    MV_CONTEXT.mFullIntrospection = false;
    var lToDelete = [];
    for (var iC = 0; null != MV_CONTEXT.mClasses && iC < MV_CONTEXT.mClasses.length; iC++)
    {
      if (undefined == MV_CONTEXT.mClasses[iC]["afy:classID"])
        { lToDelete.push(iC); continue; }
      MV_CONTEXT.mClasses[iC]["afy:classID"] = mv_with_qname(lTruncateLeadingDot(MV_CONTEXT.mClasses[iC]["afy:classID"])); // Remove the leading dot (if any) and transform into qname (prefix:name).
      if ("http://localhost/mv/class/1.0/ClassDescription" == MV_CONTEXT.mClasses[iC]["afy:classID"])
        { MV_CONTEXT.mFullIntrospection = true; }
      var lCProps = MV_CONTEXT.mClasses[iC]["afy:properties"];
      var lNewProps = new Object();
      for (iP in lCProps)
      {
        var lNewName = mv_with_qname(lTruncateLeadingDot(lCProps[iP]));
        lNewProps[iP] = lNewName;
      }
      MV_CONTEXT.mClasses[iC]["afy:properties"] = lNewProps;
    }
    for (var iD = lToDelete.length - 1; iD >= 0; iD--)
      MV_CONTEXT.mClasses.splice(lToDelete[iD], 1);
    $("#classes").empty();
    $("#class_properties").empty();
    $("#class_doc").empty();
    $("#property_doc").empty();
    $("#qnames").empty();
    if (undefined == _pJson) { console.log("populate_classes: undefined _pJson"); return; }
    for (var i = 0; i < _pJson.length; i++)
    {
      var lCName = _pJson[i]["afy:classID"];
      var lOption = "<option value=\"" + lCName + "\">" + lCName + "</option>";
      $("#classes").append(lOption);
    }
    on_class_change();
  };
  MV_CONTEXT.mQNamesDirty = true;
  var lOnClasses = new QResultHandler(lOnSuccess, null, null);
  mv_query("SELECT * FROM afy:ClassOfClasses;", lOnClasses, {keepalive:false});
}

function on_class_change()
{
  update_qnames_ui();

  var lCurClassName = $("#classes option:selected").val();
  var lCurClass = function(_pN){ for (var i = 0; null != MV_CONTEXT.mClasses && i < MV_CONTEXT.mClasses.length; i++) { if (MV_CONTEXT.mClasses[i]["afy:classID"] == _pN) return MV_CONTEXT.mClasses[i]; } return null; }(lCurClassName);
  if (undefined == lCurClass) return;
  $("#class_properties").empty();
  for (var iProp in lCurClass["afy:properties"])
  {
    var lPName = lCurClass["afy:properties"][iProp];
    var lOption = "<option value=\"" + lPName + "\">" + lPName + "</option>";
    $("#class_properties").append(lOption);
    // TODO: for each prop, show all the classes that are related directly with it; show docstring.
  }
  $("#property_doc").empty();

  var lClassDoc = $("#class_doc");
  lClassDoc.empty();
  lClassDoc.append($("<p><h4>predicate:</h4>&nbsp;" + lCurClass["afy:predicate"] + "<br/></p>"));
  
  if (MV_CONTEXT.mFullIntrospection)
  {
    var lOnDocstringSuccess = function(_pJson) { if (undefined != _pJson) { lClassDoc.append("<h4>docstring:</h4>&nbsp;"+ _pJson[0][mv_with_qname("http://localhost/mv/property/1.0/hasDocstring")]); } }
    var lOnDocstring = new QResultHandler(lOnDocstringSuccess, function(){}, null);
    mv_query("SELECT * FROM \"http://localhost/mv/class/1.0/ClassDescription\"('" + mv_without_qname(lCurClassName) + "');", lOnDocstring, {keepalive:false});
  }
}

function on_class_dblclick()
{
  var lCurClassName = mv_sanitize_classname(mv_without_qname($("#classes option:selected").val()));
  $("#query").val("SELECT * FROM " + lCurClassName + ";");
}

function on_cprop_change()
{
  update_qnames_ui();
  var lCurPropName = $("#class_properties option:selected").val();
  var lPropDoc = $("#property_doc");
  lPropDoc.empty();
  if (MV_CONTEXT.mFullIntrospection)
  {
    lPropDoc.append($("<p />"));
    var lOnDocstringSuccess = function(_pJson) { lPropDoc.append("<h4>docstring:</h4>&nbsp;"+ _pJson[0][mv_with_qname("http://localhost/mv/property/1.0/hasDocstring")]); }
    var lOnDocstring = new QResultHandler(lOnDocstringSuccess, function(){}, null);
    mv_query("SELECT * FROM \"http://localhost/mv/class/1.0/AttributeDescription\"('" + mv_without_qname(lCurPropName) + "') UNION SELECT * FROM \"http://localhost/mv/class/1.0/RelationDescription\"('" + lCurPropName + "');", lOnDocstring, {keepalive:false});
  }
}

function on_cprop_dblclick()
{
  var lCurPropName = mv_sanitize_classname(mv_without_qname($("#class_properties option:selected").val()));
  $("#query").val("SELECT * WHERE EXISTS(" + lCurPropName + ");");
}

function on_pin_click(pPID)
{
  update_qnames_ui();

  // Manage the row selection.
  if (null != MV_CONTEXT.mSelectedPID)
    { $("#" + MV_CONTEXT.mSelectedPID).removeClass("selected"); }
  MV_CONTEXT.mSelectedPID = pPID;
  $("#" + MV_CONTEXT.mSelectedPID).addClass("selected");

  // Update the selected PIN's information section.
  var lPinArea = $("#result_pin");
  lPinArea.empty();
  lPinClasses = $("<p>PIN:" + pPID + ", IS A </p>").appendTo(lPinArea);
  var lCheckClasses = function(_pNumC)
  {
    var _mNumCTotal = _pNumC;
    var _mNumCTested = 0;
    var _mNumCValidated = 0;
    var _mOnSuccess = function(__pJson, __pClass) { _mNumCTested += 1; if (parseInt(__pJson) > 0) { lPinClasses.append(" " + mv_with_qname(__pClass)); _mNumCValidated += 1; } if (_mNumCTested >= _mNumCTotal && 0 == _mNumCValidated) { lPinClasses.append("unclassified pin"); } };
    this.next =
      function(__pClass)
      {        
        var __lOnCount = new QResultHandler(_mOnSuccess, null, __pClass);
        mv_query("SELECT * FROM " + mv_sanitize_classname(__pClass) + " WHERE afy:pinID=@" + pPID + ";", __lOnCount, {countonly:true, keepalive:false});
      }
  }
  if (undefined != MV_CONTEXT.mClasses)
  {
    var lChk = new lCheckClasses(MV_CONTEXT.mClasses.length);
    for (var iC = 0; null != MV_CONTEXT.mClasses && iC < MV_CONTEXT.mClasses.length; iC++)
    {
      var lClass = mv_without_qname(MV_CONTEXT.mClasses[iC]["afy:classID"]);
      lChk.next(lClass);
    }
  }
  else
    lPinClasses.append("unclassified pin");
  var lOnDataSuccess = function(_pJson) {
    var lRefs = new Object();
    var lTxt = $("<p />");
    for (iProp in _pJson[0])
    {
      if (iProp == "id") continue;
      lTxt.append($("<span class='mvpropname'>" + iProp + "</span>"));
      lTxt.append($("<span>:" + QResultTable.createValueUI(_pJson[0][iProp], lRefs, pPID + "refdet") + "  </span>"));
    }
    lPinArea.append(lTxt);
    for (iRef in lRefs)
      { $("#" + iRef).click(function(){on_pin_click($(this).text()); return false;}); }
  }
  var lOnData = new QResultHandler(lOnDataSuccess, null, null);
  mv_query("SELECT * WHERE afy:pinID=@" + pPID + ";", lOnData, {keepalive:false});
}

function update_qnames_ui()
{
  if (!MV_CONTEXT.mQNamesDirty)
    { return; }
  var lQNames = $("#qnames");
  lQNames.empty();
  for (iP in MV_CONTEXT.mPrefix2QName)
    { lQNames.append("<option>" + MV_CONTEXT.mPrefix2QName[iP] + "=" + iP + "</option>"); }
  MV_CONTEXT.mQNamesDirty = false;
}

// TODO (Ming): special hints for divergences from standard SQL
// TODO: syntax completion etc.
// TODO: future modes (e.g. erdiagram, wizard to create pins that conform with 1..n classes, ...)
