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
 * Add searchPattern property to the Simple model. The searching will always happen on the second column.
 */
qx.Class.define("combotable.SearchableModel", {
  extend : qx.ui.table.model.Simple,
  implement : combotable.IComboTableModel,

  properties :
  {
    /**
     * The string to search for in the second column of the dataset.
     */
    searchPattern:
    {
      init     : null,
      apply    : '_applySearchPattern',
      nullable : true,
      check    : "String",
      event: "changeSearchPattern"
    },

    /**
     * Only search from the start of the string
     */
    anchorFront :
    {
      init  : false,
      check : "Boolean"
    },

    /**
     * Take string as a regular expression
     */
    searchAsRegEx :
    {
      init  : false,
      check : "Boolean"
    },

    /**
     * Loading data status
     */
    loading:
    {
      init: false,
      check: "Boolean",
      event: "changeLoading"
    }
  },

  members :
  {
    _cache : null,

    /**
     * Overridden from {@link qx.ui.table.model.Simple} with an additional
     * argument tucked at the end to tell the model if the input is to be
     * stored for filtering or is the output of the filtering operation.
     */
    setData : function(rowArr, clearSorting, filtered)
    {
      if (!filtered)
      {
          this._cache = rowArr;
      }

      this.base(arguments, rowArr, clearSorting);
    },

    /**
     * Overridden from {@link qx.ui.table.model.Simple}.
     */
    addRows : function(rowArr, startIndex, clearSorting)
    {
      // TODO: review!!!
      this.setData(this._cache);
      this.base(arguments, rowArr, startIndex, clearSorting);

      this._filterTableData();
    },

    /**
     * Overridden from {@link qx.ui.table.model.Simple}.
     */
    setRows : function(rowArr, startIndex, clearSorting)
    {
      // TODO: review!!!
      this.setData(this._cache);
      this.base(arguments, rowArr, startIndex, clearSorting);

      this._filterTableData();
    },

    /**
     * Overridden from {@link qx.ui.table.model.Simple}.
     */
    removeRows : function(startIndex, howMany, clearSorting)
    {
      // TODO: review!!!
      this.setData(this._cache);
      this.base(arguments, startIndex, howMany, clearSorting);

      this._filterTableData();
    },

    /**
     * As the search string is changed, re-filter the content of the table
     *
     * @param value {var} new string
     * @param old {var} old string
     * @return {void}
     */
    _applySearchPattern : function(value, old)
    {
      /*if (value && value == old)
      {
        return;
      }*/

      this._filterTableData();
    },

    _filterTableData: function()
    {
      var pattern = this.getSearchPattern();
      var data = [];
      var rows = this._cache;
      var anchor = this.getAnchorFront();

      if(!this._cache)
      {
        this.warn("No data to be searched through: ", rows);
        return;
      }

      if(!pattern)
      {
        // If the value in null, then show all the data
        data = this._cache;
        this.debug("value is empty", data);
      }
      else
      {
        var useRegex = this.getSearchAsRegEx();
        rows.forEach(function(row){
          if (useRegex)
          {
            this._verifyRowRegex(pattern, anchor, row, data);
          }
          else
          {
            this._verifyRow(pattern, anchor, row, data);
          }
        },this);
      }

      this.setData(data, true, true);
    },

    _verifyRow: function(value, anchor, row, data)
    {
      var idx = row[1].indexOf(value);
      if (anchor ? idx == 0 : idx != -1)
      {
        data.push(row);
      }
    },

    _verifyRowRegex: function(value, anchor, row, data)
    {
      var regex = new RegExp(value, "i");
      var idx = row[1].search(regex);
      if (anchor ? idx == 0 : idx != -1)
      {
        data.push(row);
      }
    }
  }
});
