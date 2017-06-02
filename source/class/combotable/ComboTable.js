/* ************************************************************************

   Copyright:
     Tobias Oetiker, OETIKER+PARTNER AG, www.oetiker.ch
     Mustafa Sak, SAK systems, www.saksys.de

   License:
     LGPL: http://www.gnu.org/licenses/lgpl.html
     EPL: http://www.eclipse.org/org/documents/epl-v10.php
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Tobias Oetiker (oetiker)
     * Mustafa Sak

************************************************************************ */

/**
 * If a traditional selectbox covers lots of options, it becomes pretty upractical
 * to navigate. This widget lets the user enter part of the item of interest and
 * filters the drop down box accordingly.
 *
 * It uses single column {@link qx.ui.table.Table} to present the dropdown box.
 *
 * The table model must provide a {setSearchPattern} method. If you have static data, you
 * may want to try the included {@link combotable.SearchableModel}.
 *
 * Combined with {@link qx.ui.table.model.Remote} it is possible to
 * provide access to huge datasets.
 *
 * The model in use must provide two columns. The first column containing
 * the id/key of the row and the second column the searchable data.
 *
 * @throws {Error} An error if the table model does not proved a {setSearchPattern} method.
 */
qx.Class.define("combotable.ComboTable", {
  extend: qx.ui.form.ComboBox,
  include: [ qx.ui.form.MModelProperty ],

  statics :
  {
    DEBUG_ENABLE: false
  },

  /**
   * @param tableModel {qx.ui.table.ITableModel ? null}
   *   A table model with {setSearchPattern} method and two columns as described above.
   */
  construct: function(model) {
    this.base(arguments);

    if(!model)
    {
      throw new Error("The model must be specified");
    }

    if (!model.setSearchPattern) {
      throw new Error("The model must have a setSearchPattern method. Create your own model or use combotable.SearchableModel!");
    }

    this._tableModel = model;
    this.__timerMgr = qx.util.TimerManager.getInstance();

    var textfield = this.getChildControl("textfield");
    textfield.setLiveUpdate(true);
    textfield.addListener("input", this._onTextFieldInput, this);
    this.bind("value", this, "toolTipText");
    model.bind("loading", this, "loading");
  },

  properties:
  {
    /**
     * It filters table data if an input has {limitTo} number of symbols.
     *
     * TODO: to implement a behaviour that take in account {limitTo} value
     */
    limitTo:
    {
      init: 0,
      check: "Number"
    },

    /**
     * Loading data status. This property is bound to table model property with the same name.
     */
    loading:
    {
      init  : false,
      check : "Boolean",
      apply : "_applyLoading"
    }
  },

  members:
  {
    /**
     * {combotable.SearchableModel}
     */
    _tableModel : null,

    /**
     * {qx.ui.table.Table}
     */
    _table : null,

    _highlighter: null,
    __timerMgr : null,
    __updateTimer : null,

    /**
     * As the popup data is recalculated adjust the selection and if the popup is already closed set
     * the field content.
     *
     * 1. Reset the table selection;
     * 2. If the amount of rows is greater 0 and the 'textfield' has any value then set focus on the first table row;
     *
     * @return {void}
     */
    _onTableDataChanged : function(e)
    {
      if(combotable.ComboTable.DEBUG_ENABLE)
      {
        this.debug("Table data changed", e.getData(), this._table);
      }

      var tableModel = this._tableModel;
      var table = this._table;
      var rowsAmount = tableModel.getRowCount();
      var selectionModel = table.getSelectionModel();

      // 1. Reset the table selection
      selectionModel.resetSelection();

      // 2. If the amount is greater 0 and the 'textfield' has any value
      // then set focus on the first table row.
      if (rowsAmount > 0 && this.getValue())
      {
        selectionModel.setSelectionInterval(0, 0);
        table.setFocusedCell(1, 0, true);
      }
    },

    _onTableCellDblTap: function(e)
    {
      if(combotable.ComboTable.DEBUG_ENABLE)
      {
        this.debug("Table cellDbltap: ", e.getRow(), e.getColumn(), this._table);
      }

      this._applySelectedRowData();
      this.close();
    },

    /**
     * Apply selected row data to value and model properties.
     */
    _applySelectedRowData: function()
    {
      var row = this.getSelectedRowData();
      if(combotable.ComboTable.DEBUG_ENABLE)
      {
        this.debug("Apply selected row data", row);
      }

      if (row)
      {
        this.setModel(row.key);
        this.setValue(row.value);
      }
      else
      {
        this.setModel(null);
        this.setValue(null);
      }
    },

    /**
     * Show loading notice as the table reloads.
     *
     * @param value {var} new value
     * @param old {var} old value
     * @return {void}
     */
    _applyLoading : function(value, old)
    {
      if(this._table)
      {
        this._table.setVisibility(value ? 'hidden' : 'visible');
        qx.ui.core.queue.Visibility.flush();
        qx.html.Element.flush();
      }
    },

    /**
     * Create the child chontrols.
     *
     * @param id {var} widget id
     * @param hash {Map} hash
     * @return {var} control
     */
    _createChildControlImpl : function(id, hash)
    {
      var control;

      switch(id)
      {
        case "list":
          control = new qx.ui.container.Composite(new qx.ui.layout.Canvas()).set({
            height     : this.getMaxListHeight(),
            allowGrowX : true,
            allowGrowY : true
          });

          control.add(new qx.ui.basic.Label(this.tr('Filtering ...')).set({
            padding    : [ 3, 3, 3, 3 ],
            allowGrowX : true,
            allowGrowY : true,
            enabled    : false
          }), { edge : 5 });

          var table = this._createTable();
          control.add(table, { edge : 5 });
          break;
      }

      return control || this.base(arguments, id);
    },

    _customizeTable: function()
    {
      var custom = {
        tableColumnModel : function(obj) {
          return new qx.ui.table.columnmodel.Resize(obj);
        },

        tablePaneHeader : function(obj) {
          return new combotable.NoHeader(obj);
        },

        initiallyHiddenColumns : [ 0 ]
      };

      return custom;
    },

    _createTable: function()
    {
      var tm = this._tableModel;
      var custom = this._customizeTable();
      var table = this._table = new qx.ui.table.Table(tm, custom).set({
        focusable         : false,
        keepFocus         : true,
        height            : null,
        width             : null,
        allowGrowX        : true,
        allowGrowY        : true,
        decorator         : null,
        alwaysUpdateCells : true
      });

      table.getDataRowRenderer().setHighlightFocusRow(true);

      // configure a presentation of the table
      this._configureTable(table);

      var tcm = table.getTableColumnModel();
      this._configureColumnModel(tcm);

      // bind table model property searchPattern and highlighter searchPattern
      // if highlighter is available
      if(this._highlighter)
      {
        tm.bind("searchPattern", this._highlighter, "searchPattern");
      }

      tm.addListener('dataChanged', this._onTableDataChanged, this);

      // select item from dropdown by double click
      table.addListener("cellDbltap", this._onTableCellDblTap, this);

      return table;
    },

    _configureTable: function(table)
    {
      table.set({
        showCellFocusIndicator        : false,
        headerCellsVisible            : false,
        columnVisibilityButtonVisible : false,
        focusCellOnPointerMove        : true
      });
    },

    _configureColumnModel: function(tcm)
    {
      var highlighter = this._createHighlighter();
      tcm.setDataCellRenderer(1, highlighter);
    },

    _createHighlighter: function()
    {
      this._highlighter = new combotable.CellHighlighter();
      return this._highlighter;
    },

    /**
     * Reset the value of combobox
     */
    resetValue : function()
    {
      this.setModel(null);
      this.setValue(null);

      var model = this._tableModel;
      if(model)
      {
        model.setSearchPattern(null);
      }
    },

    // overridden
    _onKeyPress : function(e)
    {
      var popup = this.getChildControl("popup");
      var identifier = e.getKeyIdentifier();

      if(combotable.ComboTable.DEBUG_ENABLE)
      {
        this.debug("On key press", identifier, popup);
      }

      // Up|Down: it makes the popup visible if it doesn't
      // Enter|Esc|Tab: it hides the popup if it's visible
      switch(identifier)
      {
        case "Down":
        case "Up":
          if (this.getLoading()) {
            e.stop();
            e.stopPropagation();
            return;
          }

          if (!popup.isVisible()) {
            this.open();
          }

          this['row' + identifier]();
          e.stop();
          e.stopPropagation();
          break;

        case "Enter":
        case "Escape":
        case "Tab":
          if (this.getLoading()) {
            e.stop();
            e.stopPropagation();
            return;
          }

          if (popup.isVisible()) {
            e.stop();
            e.stopPropagation();
            this.close();
          }

          break;
      }
    },

    /**
     * Scroll down one row
     *
     * @return {void}
     */
    rowDown: function()
    {
      var row = this.getSelectedRowData();
      var table = this._table;

      if (!row)
      {
        table.setFocusedCell(1, 0, true);
        table.getSelectionModel().setSelectionInterval(0, 0);
      }
      else
      {
        if (row.rowId + 1 < this._tableModel.getRowCount()) {
          table.setFocusedCell(1, row.rowId + 1, true);
          table.getSelectionModel().setSelectionInterval(row.rowId + 1, row.rowId + 1);
        }
      }
    },

    /**
     * Scroll up one row
     *
     * @return {void}
     */
    rowUp: function()
    {
      var row = this.getSelectedRowData();
      var table = this._table;

      if (!row)
      {
        table.setFocusedCell(1, 0, true);
        table.getSelectionModel().setSelectionInterval(0, 0);
      }
      else
      {
        if (row.rowId - 1 >= 0) {
          table.setFocusedCell(1, row.rowId - 1, true);
          table.getSelectionModel().setSelectionInterval(row.rowId - 1, row.rowId - 1);
        }
      }
    },

    //Overridden
    _onTap : function(e) {  },

    //Overridden
    _onListChangeSelection : function(e) {},

    //Overridden
    _onPopupChangeVisibility : function(e) {
      var visibility = e.getData();
      if(combotable.ComboTable.DEBUG_ENABLE)
      {
        this.debug("On popup change visibility:", visibility);
      }

      if (visibility == 'hidden')
      {
        this.getChildControl("button").removeState("selected");
      }
      else
      {
        this.getChildControl("button").addState("selected");
      }
    },

    //Overridden
    _onTextFieldInput : function(e)
    {
      //After a user provided any input, the popuped table data is filtered

      var value = e.getData();
      var table = this._table;

      if(combotable.ComboTable.DEBUG_ENABLE)
      {
        this.debug("On textfield input:", value, " The table:", table);
      }

      // open only if focused
      if(this.getChildControl("textfield").hasState("focused"))
      {
        this.open();
      }

      // clear focus in table control
      var selectionModel = table.getSelectionModel();
      selectionModel.resetSelection();
      table.setFocusedCell(null, null, false);

      if (this.__updateTimer)
      {
        this.__timerMgr.stop(this.__updateTimer);
      }

      // set table model property searchPattern in 150ms
      this.__updateTimer = this.__timerMgr.start(function(userData, timerId) {
        this.__updateTimer = null;
        this._tableModel.setSearchPattern(userData);
      }, null, this, value, 150);

      this.fireDataEvent("input", value, e.getOldData());
    },

    // Overridden
    _onTextFieldChangeValue : function(e)
    {
      if(combotable.ComboTable.DEBUG_ENABLE)
      {
        this.debug("On textfield value changed to:", e.getData()," The old one: ", e.getOldData());
      }

      this.fireDataEvent("changeValue", e.getData(), e.getOldData());
    },

    /**
     * Get id and data curently selected.
     *
     * @return {var} map with id and data and rowId keys
     */
    getSelectedRowAllData : function()
    {
      var table = this._table;
      var sel = table.getSelectionModel().getSelectedRanges();
      var tm = this._tableModel;
      var rowData = null;

      for (var i=0; i<sel.length; i++) {
        var interval = sel[i];

        for (var s=interval.minIndex; s<=interval.maxIndex; s++) {
          var key = tm.getValue(0, s);
          var value = tm.getValue(1, s);

          rowData = tm.getRowData(s);
        }
      }

      return rowData;
    },

    /**
     * Get id and data curently selected
     *
     * @return {var} map with id and data and rowId keys
     */
    getSelectedRowData : function()
    {
      var table = this._table;
      var sel = table.getSelectionModel().getSelectedRanges();
      var tm = this._tableModel;
      var rowData = null;

      for (var i=0; i<sel.length; i++)
      {
        var interval = sel[i];

        for (var s = interval.minIndex; s<= interval.maxIndex; s++)
        {
          var key = this._getSelectedKey(tm, s);
          var value = this._getSelectedValue(tm, s);

          rowData = {
            rowId : s,
            key   : key,
            value : value
          };
        }
      }

      return rowData;
    },

    /**
     * Get model data for selected row
     */
    _getSelectedModel: function()
    {
      var table = this._table;
      var selection = table.getSelectionModel().getSelectedRanges();
      var tableModel = this._tableModel;
      var model = null;

      for (var i=0; i<selection.length; i++)
      {
        var interval = selection[i];

        for (var rowId = interval.minIndex; rowId<= interval.maxIndex; rowId++)
        {
          var key = this._getSelectedKey(tableModel, rowId);
          var value = this._getSelectedValue(tableModel, rowId);

          model = {
            rowId : rowId,
            key   : key,
            value : value
          };
        }
      }

      return model;
    },

    /**
     * Get key from selected row.
     */
    _getSelectedKey: function(tableModel, rowId)
    {
      var key = tableModel.getValue(0, rowId);
      return key;
    },

    /**
     * Get value from selected row.
     */
    _getSelectedValue: function(tableModel, rowId)
    {
      var value = tableModel.getValue(1, rowId);
      return value;
    }
  }
});
