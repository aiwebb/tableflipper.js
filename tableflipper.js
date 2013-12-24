
function Tableflipper(config) {
	this.selectionIDs = {}
	this.autorender   = true
	this.emptyMsg     = 'There are no records to display.'
	this.idKey        = 'id'

	_.extend(this, config)

	this.init()

	return this
}

Tableflipper.prototype.init = function() {
	this.$frame = $('<div>').addClass('tf-frame')
	this.$target.append(this.$frame)

	this.$frame.on('click', '.tf-row', $.proxy(this.handleRowClick, this))
	this.$frame.on('scroll', $.proxy(this.renderRows, this))

	this.build()

	// Attempt rendering, and set up autorendering
	this.rendered = false
	this.render()
	if (!this.rendered && this.autorender) {
		var self = this
		this.renderRepeater = setInterval(function() {
			self.render()
			if (self.rendered) {
				clearInterval(self.renderRepeater)
			}
		}, 250)
	}
}

Tableflipper.prototype.build = function() {
	this.buildHeader()
	this.buildFooter()
	this.buildBody()
}

Tableflipper.prototype.fixRowWidths = function() {
	_.each(this.columns, function(column, index) {
		this.$frame.find('.tf-cell[key="'+column.key+'"]').css({width: column.width || 'auto'})
	}, this)
}

Tableflipper.prototype.buildHeader = function() {
	this.$header = $('<div>').addClass('tf-header')

	_.each(this.columns, function(column, index) {
		var $cell = $('<div>').addClass('tf-cell')
			.data('column', column)
			.attr('name',   column.name)
			.attr('key',    column.key)

		this.$header.append($cell)

		var renderer = column.headerRenderer || this.defaultHeaderRenderer
		renderer($cell)
	}, this)

	this.$frame.append(this.$header)
}

Tableflipper.prototype.buildFooter = function() {
	this.$footer = $('<div>').addClass('tf-footer').toggle(!!this.includeFooter)

	_.each(this.columns, function(column, index) {
		var $cell = $('<div>').addClass('tf-cell')
			.data('column', column)
			.attr('name',   column.name)
			.attr('key',    column.key)

		this.$footer.append($cell)

		var renderer = column.footerRenderer || this.defaultFooterRenderer
		renderer($cell)
	}, this)

	this.$frame.append(this.$footer)

	this._footerHeight = this.$footer.outerHeight()
}

Tableflipper.prototype.buildBody = function() {
	this.$body = $('<div>').addClass('tf-body')
		.css('marginBottom', this.rowHeight * this.data.length)

	this.$frame.append(this.$body)
}

Tableflipper.prototype.render = function() {
	if (!this.fixDimensions()) {
		this.rendered = false
		console.log('render failed')
		return false
	}

	this._suspendScrollHandling = false
	this.renderRows()
	this.rendered = true
	console.log('render succeeded')
	return true
}

Tableflipper.prototype.fixDimensions = function() {
	// Snap header and footer widths to body width
	var bodyWidth = this.$body.width()
	if (bodyWidth == 0) {return false}
	this.$header.width(bodyWidth)
	this.$footer.width(bodyWidth)

	// Store header and footer heights, now that we know they have a width
	this._headerHeight = this.$header.outerHeight()
	this._footerHeight = this.$footer.outerHeight()

	// Snap margins of body to header/footer heights
	// var expectedTotal = this.data.length * this.rowHeight
	// var marginTop     = parseInt(this.$body.css('marginTop'   ))
	// var marginBottom  = parseInt(this.$body.css('marginBottom'))
	// if (marginTop + marginBottom + this.$body.height() != expectedTotal) {
	// 	this.$body.css({
	// 		marginTop:    marginTop    + this._headerHeight,
	// 		marginBottom: marginBottom + this._footerHeight
	// 	})
	// }

	// Snap footer position
	if (this.data) {
		var marginBottom = parseInt(this.$body.css('marginBottom'))
		if (marginBottom < this.rowHeight * this.data.length) {
			this.$body.css('marginBottom', this.rowHeight * this.data.length)
		}

		this.$footer.css({
			top: this.$target.position().top + Math.min(this.$frame.height() + 42, this.$target.height()) - this._footerHeight - 1
		})
	}

	return true
}

Tableflipper.prototype.renderRows = function() {
	if (this._suspendScrollHandling) {return}

	this._suspendScrollHandling = true

	/*=====================================
	=            EMPTY MESSAGE            =
	=====================================*/
	// Handle zero records case
	if (!this.data.length) {
		// Add empty message
		this.$body.empty().append($('<div>').addClass('tf-empty-msg').html(this.emptyMsg))

		// Fix footer position
		this.$footer.css('marginTop', 60)

		// Fix row widths
		this.fixRowWidths()

		return
	}
	else {
		this.$body.find('.tf-empty-msg').remove()
		this.$footer.css('marginTop', 0)
		// this.$body.css('marginBottom', this.rowHeight * this.data.length)
	}

	/*===============================================
	=            CALCULATE RENDER WINDOW            =
	===============================================*/
	// Calculate base number of rows
	var bodyHeight = this.$target.height() - this.$header.outerHeight() - this.$footer.outerHeight()
	var baseRows   = bodyHeight / this.rowHeight

	// Calculate virtual row position as well as the first and last records to render
	var top              = this.$frame.scrollTop()
	var vRowPos          = top / this.rowHeight
	var vFactor          = 5
	var firstRenderIndex = Math.max(Math.floor(vRowPos - (baseRows * vFactor)), 0)
	var lastRenderIndex  = Math.min(Math.ceil(vRowPos + (baseRows * vFactor + baseRows)), this.data.length - 1)

	/*============================================================
	=            REMOVE ROWS OUTSIDE OF RENDER WINDOW            =
	============================================================*/
	// Mark rows for removal from beginning/end
	_.each(this.$body.find('.tf-row'), function(row, index) {
		var $row = $(row)
		if ($row.attr('index') < firstRenderIndex) {
			$row.addClass('unprepend')
		}
		else if ($row.attr('index') > lastRenderIndex) {
			$row.addClass('unappend')
		}
	})

	// Remove everything in one update
	this.$body.find('.unprepend, .unappend').remove()

	/*========================================
	=            ADD MISSING ROWS            =
	========================================*/
	// Find first and last existing record indexes
	var firstExistingIndex = this.$body.find('.tf-row').first().attr('index') || null
	var lastExistingIndex  = this.$body.find('.tf-row').last() .attr('index') || null

	// Create any missing rows and add them to prepend/append lists
	var $rowsToPrepend = [], $rowsToAppend = []
	for (i = firstRenderIndex; i <= lastRenderIndex; i++) {
		var record = this.data[i]
		var $row = this.$body.find('[id="'+record[this.idKey]+'"]')
		if (!$row.length) {
			// We don't have a row for this record - create one
			$row = $('<div>').addClass('tf-row')
				.data('record', record)
				.attr('id',     record[this.idKey])
				.attr('index',  i)

			_.each(this.columns, function(column, index) {
				var $cell = $('<div>').addClass('tf-cell')
					.attr('value', record[column.key])
					.attr('key',   column.key)

				$row.append($cell)

				var renderer = column.bodyRenderer || this.defaultCellRenderer
				renderer($cell)
			}, this)

			// Figure out whether it should be prepended or appended
			if (i < firstExistingIndex) {
				$rowsToPrepend.push($row)
			}
			else {
				$rowsToAppend.push($row)
			}
		}
	}

	// Prepend and append the lists of new rows
	this.$body.prepend($rowsToPrepend).append($rowsToAppend)

	// Adjust margins
	this.$body.css('marginTop',    this._headerHeight + firstRenderIndex * this.rowHeight)
	this.$body.css('marginBottom', this._footerHeight + (this.data.length - lastRenderIndex - 1) * this.rowHeight)

	// Reset scroll location
	this.$frame.scrollTop(top)
	this._suspendScrollHandling = false

	// Fix row widths
	this.fixRowWidths()
}

Tableflipper.prototype.defaultHeaderRenderer = function($cell) {$cell.empty().html($cell.attr('name')  || '')}
Tableflipper.prototype.defaultCellRenderer   = function($cell) {$cell.empty().html($cell.attr('value') || '')}
Tableflipper.prototype.defaultFooterRenderer = function($cell) {$cell.empty().html(' ')}

Tableflipper.prototype.handleRowClick = function(e) {
	var $row = $(e.target).closest('.tf-row')

	// row is selected
		// is only selection
			// deselect row
		// is not only selection
			// deselect all, select row
	// row is not selected
		// deselect all, select row

	if (this.isSelected($row)) {
		if (this.getSelections().length == 1) {
			// This is the only selected row, so the click is a deselect
			// this.deselect($row)
		}
		else {
			// This is one of many selected rows, so the click is a change in selection
			// this.setSelection($row)
		}
	}
	else {
		// This is an unselected row, so the click is a change in selection
		// this.setSelection($row)
	}
}

Tableflipper.prototype.select = function($row) {
	// this.selections[$row.attr('id')] = true
	// $row.addClass('tf-selected')

	// _.keys(this.selections)
}

Tableflipper.prototype.deselect = function($row) {
	$row.removeClass('tf-selected')
}

Tableflipper.prototype.getSelections = function() {
	return this.$body.find('.tf-selected')
}

Tableflipper.prototype.isSelected = function($row) {
	return $row.hasClass('tf-selected')
}

Tableflipper.prototype.deselectAll = function() {
	this.getSelections().removeClass('tf-selected')
}

Tableflipper.prototype.setSelection = function($items) {
	if (!_.isArray($items)) {$items = [$items]}

	this.deselectAll()

	_.each($items, function($item, index) {
		$item.addClass('tf-selected')
	})
}

if ($('#tf-target').length) {
	window.tf = new Tableflipper({
		$target: $('#tf-target'),
		includeFooter: true,
		columns: [
			{name: 'A', key: 'a', width: '350px'},
			{name: 'B', key: 'b', width: '40%', headerRenderer: function($cell) {
				$cell.empty().html(':-)')
			}, footerRenderer: function($cell) {
				$cell.empty().html(':-|')
			}}
		],
		rowHeight: 19,
		data: generateRecords(1000000),
		footer: true
	})

	function generateRecords(numRecords) {
		var records = []

		for (var i = 1; i <= numRecords; i++) {
			records.push({
				id: i * 10,
				a:  'foo ' + i,
				b:  'bar ' + i,
				c:  'bat ' + i
			})
		}

		return records
	}
}
