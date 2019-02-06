/*
Copyright © 2019 David R King

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var KSGF = (function() { 'use strict';

	var version = "0.1";
	var defaultBoardsize = 11;
	var EMPTY = 0;
	var BLACK = 1;
	var WHITE = 2;
	var appName = "KSGF library v" + version;
	var errorMessages = [
		"success", // 0
		"opening bracket not found",
		"root node empty",
		"wrong version of SGF", // 3
		"not a Hex game",
		"faulty boardsize",
		"faulty cell value", // 6
		"faulty added cell value",
		"faulty cell value",
		"no valid move specified in node", // 9
		"no branch opening bracket found",
		"closing bracket not found",
		"branch closing bracket not found", // 12
		"stones placed off the board or duplicates"
	];

	// **************Game 'class'**************
	function Game() {
		this.rows = defaultBoardsize; // number of rows of cells
		this.cols = defaultBoardsize; // number of columns of cells		
		this.rootMove = new Move();
		this.currentMove = this.rootMove;
		this.firstPlayer = BLACK;
		this.currentTurn = this.firstPlayer;
		this.addedBlackStones = []; // stones added at the start, for instance to demonstrate a template; not applicable in a real game
		this.addedWhiteStones = []; // array of Cell
		this.errorCode = 0;
	}
	
	Game.prototype.makeMove = function (row, col) { // or makeMove(cell) or makeMove("a1")
		var cell = getCell(row, col);
		if ( !this.isCellEmpty(cell) ) return false;
		var nextMoveFound = false;  // now check for moves already tried
		for (var i = 0, l = this.currentMove.nextMoves.length; i < l; i++) { 
			var m = this.currentMove.nextMoves[i];
			if ( (m.row == cell.row) && (m.col == cell.col) ) {
				currentMove = m;
				nextMoveFound = true;
				break;
			}
		}
		if ( !nextMoveFound ) { // it's a new, untried cell
			var newMove = new Move(cell.row, cell.col);
			this.currentMove.nextMoves.push(newMove);
			newMove.previousMove = this.currentMove;
			this.currentMove = newMove;
		}
		this.changeTurn();
	};

	Game.prototype.goBack = function () {
		if ( this.currentMove.isRoot() ) return;
		this.currentMove = this.currentMove.previousMove;
		this.changeTurn();	
	};
	
	Game.prototype.erase = function () {
		if ( this.currentMove.isRoot() ) return;
		let move = this.currentMove;
		this.currentMove = this.currentMove.previousMove;
		for (var i = 0, l = this.currentMove.nextMoves.length; i < l; i++) {
			if ( move == this.currentMove.nextMoves[i]) {
				this.currentMove.nextMoves.splice(i, 1); // remove the reference to the old move
				// once 'move' is out of scope, there is no remaining reference to the moves tree
				// above here, so js will delete the Moves at some point.														
				break;
			}
		}
		this.changeTurn();
	};

	Game.prototype.encode = function () { // returns a formatted SGF representation of this game
		var text = "(";
		text += writeMove(this, this.rootMove); // starting from zeroMove
		text += "\n)\n";
		return text;			
	};
	
	//writeMove writes Move m and the Moves in nextMoves	
	function writeMove(thisgame, m, turn, indent) {
		indent = indent || 0; // indentation = (number of spaces - 1) at this point
		var text = "";
		if (m.previousMove == thisgame.rootMove && thisgame.rootMove.nextMoves.length == 1) {
			text = "\n "; //test for 1st single node
			indent = 1;
		}
		text += writeSingleNode(thisgame, m, turn); // eg ;B[9e]C[good move]
		turn = (turn == BLACK) ? WHITE : BLACK; // rootMove is set to WHITE, then incremented to BLACK for first played Move
		if (m.nextMoves.length == 0) return text;
		if (m.nextMoves.length == 1) { // just one branch
			text += writeMove(thisgame, m.nextMoves[0], turn, indent);
		} else { // there is more than one branch
			indent++;
			var indentStr = "";
			for (var j=0; j<indent; j++) indentStr += " "; // repeat() doesn't work on IE
			for (var i=0; i<m.nextMoves.length; i++) {
				text += "\n" + indentStr + "(" ;
				text += writeMove(thisgame, m.nextMoves[i], turn, indent);
				text += ")";
			}
		}
		return text;		
	}
	
	function writeSingleNode(thisgame, m, turn) { //eg B[9e]C[good move]
		var turnChar = (turn == BLACK) ? "B" : "W";
		var text;
		if ( m.isRoot() ) {
			var size = (thisgame.cols == thisgame.rows) ? thisgame.cols : thisgame.cols + ":" + thisgame.rows;
			text = ";FF[4]GM[11]AP[" + appName + "]SZ[" + size + "]";
			if (thisgame.addedBlackStones.length > 0 ) {
				text += "AB";
				for (var i=0; i<thisgame.addedBlackStones.length; i++)
					text += "[" + getCellIDText(thisgame.addedBlackStones[i].row, thisgame.addedBlackStones[i].col) + "]";
			}
			if (thisgame.addedWhiteStones.length > 0 ) {
				text += "AW";
				for (var i=0; i<thisgame.addedWhiteStones.length; i++)
					text += "[" + getCellIDText(thisgame.addedWhiteStones[i].row, thisgame.addedWhiteStones[i].col) + "]";			
			}	
			if (m == thisgame.currentMove) text += "IP[]"; // initial position
		} else {
			if (m.swap) {
				text = ";" + turnChar + "[swap-pieces]";
			} else {
				text = ";" + turnChar + "[" + getCellIDText(m) + "]";
			}
			if (m == thisgame.currentMove) text += "IP[]";
		}
		if (m.comment.length > 0) text += "C[" + m.comment.replace(/[\\\]]/g, '\\$&')  + "]"; // add slashes
		return text;	
	}
	
	Game.prototype.stripComments = function (move) { //delete any comments from the move and the following move branches
		move = move || this.rootMove;
		move.comment = "";
		for (var i=0; i<move.nextMoves.length; i++)
			this.stripComments( move.nextMoves[i] );
	};
	
	Game.prototype.isCellEmpty = function (row, col) { // isCellEmpty(row, col) or isCellEmpty(cell) or isCellEmpty("a1")
		if ( !this.isCellOnBoard(row, col) ) return false;
		var cell = getCell(row, col);
		var m = this.currentMove;
		while ( !m.isRoot() ) {
			if ( (m.row == cell.row) && (m.col == cell.col) ) return false;  // cell is already occupied
			m = m.previousMove;
		}
		for (var i=0; i<this.addedBlackStones.length; i++)
			if ( (this.addedBlackStones[i].row == cell.row) && (this.addedBlackStones[i].col == cell.col) ) return false; // cell occupied by added stone
		for (var i=0; i<this.addedWhiteStones.length; i++)
			if ( (this.addedWhiteStones[i].row == cell.row) && (this.addedWhiteStones[i].col == cell.col) ) return false; // cell occupied by added stone
		return true;	
	};
	
	Game.prototype.isCellOnBoard = function (row, col) { // isCellOnBoard(row, col) or isCellOnBoard(cell) or isCellOnBoard("a1")
		var cell = getCell(row, col);
		return (cell.row >= 1 && cell.col >= 1 && cell.row <= this.rows && cell.col <= this.cols );
	};	
	
	Game.prototype.decode = function (text) { //  decode the given SGF text
	// returns true if success, otherwise false and errorCode, errorMessage()
		var firstPlayer = BLACK;
		var rows = defaultBoardsize;
		var cols = defaultBoardsize;
		var addedBlackStones = [];
		var addedWhiteStones = []; 
		var gameText = new SGFText(text); // text stream
		var c = gameText.getChar();
		if (c !== "(") {this.errorCode = 1; return false;} // opening bracket not found
		// get root node
		var properties = readNode(gameText);
		if (properties == null || properties.length < 1) {this.errorCode = 2; return false;} // root node empty
		// NB "Property-identifiers are defined as keywords using only uppercase letters"
		for (var i = 0; i<properties.length; i++) { // find SGF version FF[4] and hex game id GM[11] and 1st player and boardsize
			var pv = properties[i].propValues[0];
			if (properties[i].propIdent == "FF") {
				if ( parseInt(pv,10) !== 4 ) {this.errorCode = 3; return false;} // wrong version of SGF
			} else if (properties[i].propIdent == "GM") {
				if ( parseInt(pv,10) !== 11 ) {this.errorCode = 4; return false;} // not a Hex game
			} else if (properties[i].propIdent == "PL") {
				if (pv.charAt(0) == "W") 	firstPlayer = WHITE; // ignore anything else
			} else if (properties[i].propIdent == "SZ") {
				var sizes = pv.split(":", 3);
				cols = parseInt(sizes[0],10);
				if ( isNaN(cols) || cols < 3 || cols > 26 ) {this.errorCode = 5; return false;} // faulty boardsize
				if (sizes.length > 1) {
					rows = parseInt(sizes[1],10);
					if ( isNaN(rows) || rows < 3 || rows > 26 ) {this.errorCode = 5; return false;} // faulty boardsize
				} else {
					rows = cols;
				}
			} else if (properties[i].propIdent == "AB" || properties[i].propIdent == "AW") {
				for (var p = 0; p<properties[i].propValues.length; p++) {
					var val = properties[i].propValues[p];
					val = val.trim();
					if ( !(val.length == 2 || val.length == 3) ) {this.errorCode = 7; return false;}; // faulty added cell value
					var c = parseInt(val.charCodeAt(0) - "a".charCodeAt(0) + 1); // eg b
					var r = parseInt(val.slice(1, val.length)); // eg 6, 12
					if (!Number.isInteger(r) || !Number.isInteger(c)) {this.errorCode = 7; return false;}; // faulty added cell value
					if ( properties[i].propIdent == "AB") addedBlackStones.push(new Cell(r, c));
					else addedWhiteStones.push(new Cell(r, c));
				}
			}	
		} // if FF[] or GM[] not found, or if multiples found (eg PL[Green!]PL[W], don't worry
		var rootMove = new Move();
		var result = processBranch(rootMove, gameText, BLACK);
		if (result !== 0) {this.errorCode = result; return false;}
		//check the board - no duplicates, all stones on the board
		if ( !isBoardOK(rootMove, addedBlackStones, addedWhiteStones, rows, cols) ) {this.errorCode = 13; return false;}; // faulty stones
		this.currentMove = findIP(rootMove) || findLast(rootMove);
		stripIP(rootMove);		
		this.currentTurn = findCurrentTurn(this.currentMove, firstPlayer);
		this.rootMove = rootMove;
		this.firstPlayer = firstPlayer;
		this.rows = rows;
		this.cols = cols;
		this.addedBlackStones = addedBlackStones;
		this.addedWhiteStones = addedWhiteStones;		
		this.errorCode = 0;
		return true; // success
	};
	
	function processBranch(m, gameText, currTurn) {
	// m is the current move during game construction
	// branch starts with either a single node ;W[a1] or multiple nodes (;W[a1].. )  (;W[b2].. )  ...
		if (gameText.testChar() == ")") return 0; // we've found the end of this game or branch
		var result = processSingleBranch(m, gameText, currTurn); // look for ;W[a1] ...
		if (result < 0) result = processMultipleBranches(m, gameText, currTurn); // no node was found, so look for (;W[a1].. )  (;W[b2].. )  ...
		return result;  // >0 an error occurred; ==0 all well	
	}
	
	function processSingleBranch(m, gameText, currTurn) {
	// returns -1 if no node found, 0 if success, a +ve error code if fail
	// decodes an entire branch starting at a single node
		var properties = readNode(gameText);
		if (properties == null) return -1; // no node found
		var r = null;
		var c = null;
		var newMove = null;
		var moveIdent = (currTurn == BLACK) ? "B" : "W";
		var moveFound = false;
		var ip = false;
		var comment = "";
		for (var i = 0; i<properties.length; i++) {
			var val = properties[i].propValues[0];
			if ((properties[i].propIdent == moveIdent) && !moveFound) { // B[..] or W[..]
				moveFound = true;
				val = val.trim(); // there should be no whitespace, but we can cope if so
				if (val == "swap-pieces") {
					newMove = new Move();
					newMove.row = m.row;
					newMove.col = m.col;
					newMove.swap = true;
				} else if (val.length == 2 || val.length == 3) {
					var c = parseInt(val.charCodeAt(0) - "a".charCodeAt(0) + 1); // eg b
					var r = parseInt(val.slice(1, val.length)); // eg 6, 12
					if (!Number.isInteger(r) || !Number.isInteger(c)) return 6; // faulty cell value
					newMove = new Move();
					newMove.row = r;
					newMove.col = c;
				} else return 8; // faulty cell value
			}
			if (properties[i].propIdent == "IP") {  // initial position
				ip = true;
			}
			if (properties[i].propIdent == "C") {  // comment
				comment = val;
			}			
		}
		if (newMove == null) return 9; // no valid move specified in node
		if ( ip ) newMove.ip = true;
		newMove.comment = comment;
		m.nextMoves.push(newMove);
		newMove.previousMove = m;
		currTurn = (currTurn == BLACK) ? WHITE : BLACK;
		
		return processBranch(newMove, gameText, currTurn);	
	}
	
	function processMultipleBranches(m, gameText, currTurn) {
	// look for (;W[a1].. )  (;W[b2].. )  ...
	//return 0 for success or an error code
		var c = gameText.getChar();
		if (c !== "(") return 10; // no branch opening bracket found
		var result = processSingleBranch(m, gameText, currTurn); // must have a node after ( - cannot have (( ;node ... ))
		if (gameText.getChar() !== ")") return 11; // closing bracket not found
		while ( gameText.testChar() == "(" ) { // get 2nd and subsequent (;W[b2].. )  ...  if any
			c = gameText.getChar(); // will be (
			result = processSingleBranch(m, gameText, currTurn);
			if (gameText.getChar() !== ")") return 12; // branch closing bracket not found
		}
		return 0;	
	}
	
	function readNode(gameText) {
	// return an array of properties or null
	// gameText is passed by reference; this allows you to modify the original gameText
		gameText.save(); // save the stream pointer position
		var properties=[];
		var c = gameText.getChar(); // ignoring whitespace
		if (c !== ";") { gameText.restore(); return null; } 
		var property = readProperty(gameText); // zero properties is OK
		while (property !== null) {
			properties.push(property);
			property = readProperty(gameText); 
		}
		return properties;	
	}
	
	function readProperty(gameText) {
	//return {propIdent, propValues} or null; propValues is an array
	//propValues: generally just one eg B[d2], but possibly a list eg AB[d2][f6][a1]
		gameText.save(); // save the stream pointer position
		var propIdent="";
		var c;
		
		//get propIdent	
		c = gameText.getChar(); // ignoring whitespace

		while (c !== null && isUpperCase(c)) {
			propIdent += c;
			if  ( propIdent.length>12 ) { gameText.restore(); return null; } // a random cut-off for possible length 
			c = gameText.getChar();
		}
		if  ( propIdent.length<1 || c!=="[" ) { gameText.restore(); return null; }

		// now get propValue(s)
		var propValues = [];
		var propValue;
		while (c == "[") {
			propValue = "";
			c = gameText.getAnyChar();
			while (  c !== null  && c !== "]") {
				if (c == "\\") c = gameText.getAnyChar();
				if (c == null) { gameText.restore(); return null; } 
				propValue += c;
				c = gameText.getAnyChar();
			}
			if (c == null) { gameText.restore(); return null; } // must close property with ]
			// 	it's OK for propValue to be ""
			propValues.push(propValue);
			if (gameText.testChar() == "[") c = gameText.getChar(); // we have another propValue in the list
		}
		return {propIdent: propIdent, propValues: propValues};
	}
	
	function findIP(move) { // returns the first occurrence of .ip in the move tree, null if none
		var m;
		if (move.ip) return move;
		for (var i=0; i<move.nextMoves.length; i++) { // won't execute if no nextMoves
			m = findIP( move.nextMoves[i] );
			if (m !== null) return m;
		}
		return null;
	}
	
	function findLast(move) { // returns the last move in the tree
		if (move.nextMoves.length > 0) return findLast( move.nextMoves[move.nextMoves.length-1] );
		return move;
	}
	
	function stripIP(move) { // delete any IP properties from the move and the following move branches
		delete move.ip; // delete returns true (or false if it fails to delete); no need to test if there is ip
		for (var i=0; i<move.nextMoves.length; i++)
			stripIP( move.nextMoves[i] );
	}

	function isBoardOK(rootMove, addedBlackStones, addedWhiteStones, rows, cols) { // returns true if all stones on the board, no duplicates
		var cellContents = [];
		for (var i = 0; i<=rows; i++) {
			cellContents[i] = [];
			for (var j = 0; j<=cols; j++) {
				cellContents[i].push(EMPTY);
			}
		}
		for (var i = 0; i<addedBlackStones.length; i++) {
			var c = addedBlackStones[i];
			if  (c.row < 1 || c.row > rows || c.col < 1 || c.col > cols) return false;
			if (cellContents[c.row][c.col] !== EMPTY) return false;
			cellContents[c.row][c.col] = BLACK;
		}
		for (var i = 0; i<addedWhiteStones.length; i++) {
			var c = addedWhiteStones[i];
			if  (c.row < 1 || c.row > rows || c.col < 1 || c.col > cols) return false;
			if (cellContents[c.row][c.col] !== EMPTY) return false;
			cellContents[c.row][c.col] = BLACK;
		}
		return checkMoves(rootMove, cellContents, rows, cols);
	}
	
	function checkMoves(move, cellContents, rows, cols) {
		for (var i=0; i<move.nextMoves.length; i++) {
			var m = move.nextMoves[i];
			if  (m.row < 1 || m.row > rows || m.col < 1 || m.col > cols) return false; // off board
			if (cellContents[m.row][m.col] !== EMPTY) return false; //duplicate
			cellContents[m.row][m.col] = BLACK; // colour is irrelevant - we just test if the cell is EMPTY
			if ( !checkMoves(m, cellContents, rows, cols) ) return false;
			cellContents[m.row][m.col] = EMPTY; // restore
		}
		return true;
	}
	
	
	function findCurrentTurn(move, firstPlayer) {
	var m = move;
		var turn = BLACK; // guess
		do {
			if ( m.isRoot() ) return (turn == firstPlayer) ? BLACK : WHITE;
			turn = (turn == WHITE) ? BLACK : WHITE;
		} while ( m = m.previousMove );
	}
	
	Game.prototype.changeTurn = function () {
		if (this.currentTurn == BLACK) this.currentTurn = WHITE;
		else this.currentTurn = BLACK;	
	};
	
	Game.prototype.getErrorMessage = function () {
		return errorMessages[this.errorCode];
	};
	
	Game.prototype.addBlackStone = function (row, col) {
		if ( !this.isCellEmpty(row, col) ) return false;
		this.addedBlackStones.push(new Cell(row, col));
		return true;
	};

	Game.prototype.addWhiteStone = function (row, col) {
		if ( !this.isCellEmpty(row, col) ) return false;
		this.addedWhiteStones.push(new Cell(row, col));
		return true;
	};		
	
	function SGFText(text) { // SGFtext stream class
		this.text = text;
		this.readPosition = 0; // position of next character to be read
		this.savedPosition = 0;
		this.save = function() {
			this.savedPosition = this.readPosition;
		};
		this.restore = function() {
			this.readPosition = this.savedPosition;
		};
		this.getAnyChar = function() { // including whitespaces
			if ( this.readPosition > this.text.length-1 ) return null;
			return this.text.charAt(this.readPosition++);
		};
		this.getChar = function() { // ignoring whitespace
			var c;
			do {
				if ( this.readPosition > this.text.length-1 ) return null;
				c = this.text.charAt(this.readPosition++);
			} while ( c.trim()=="" ); // while char is whitespace, including newlines
			return c;
		};
		this.testChar = function() { // getChar() without moving read pointer
			var r = this.readPosition;
			var c = this.getChar();
			this.readPosition = r;
			return c;
		};
		this.lastChars = function(n) { // return the last n characters read
			var e = Math.min(this.readPosition + 1, this.text.length);
			var s = Math.max(this.readPosition - n, 0);
			return this.text.slice(s, e);
		}
	}	
	
	
	// **************Move 'class'**************
	function Move(row, col) { // or Move(cell) or Move("a1")
		var cell = getCell(row, col);
		this.row = cell.row; // starts at 1
		this.col = cell.col; // starts at 1
		this.previousMove = null;
		this.nextMoves = [];
		this.comment = "";
	}
	
	Move.prototype.isRoot = function () {
		return (this.previousMove == null);
	};

	Move.prototype.nextMovesCount = function () {
		return this.nextMoves.length;
	};	
	
	Move.prototype.isOnPathTo = function (targetMove) {
		var m = targetMove;
		do {
			if (m == this) return true;
			m = m.previousMove
		} while (m !== null);
		return false;
	};

	Move.prototype.getnextMoveOnPath = function (targetMove) {
	// returns next move on the path towards targetMove, or null
		var m = targetMove;
		var m1 = null;
		do {
			if (m == this) return m1;
			m1 = m;
			m = m.previousMove
		} while (m !== null);
		return null;
	};
	
	Move.prototype.getNextMove = function () { // get the first given next move, or null
		if (this.nextMoves.length == 0) return null;
		return this.nextMoves[0];
	};

	// **************Cell 'class'***************
	function Cell(row, col) { // or Cell(cell) or Cell("a1")
		var cell = getCell(row, col);
		this.row = cell.row;
		this.col = cell.col;
	}

	function isUpperCase(str) {
		if (str == null) return false;
		return (str == str.toUpperCase()) && (str != str.toLowerCase()); // 'cos "5".toUpperCase() is 5
	}
	
	// **************utilities***************
	function setAppName(name) {
		appName = name;
	}
	
	function getCellIDText(row, col) { // gets eg "a4" from various input formats
		var cell = getCell(row, col);
		return String.fromCharCode("a".charCodeAt(0) - 1 + cell.col) + cell.row;	
	}
	
	function getCell(arg1, arg2) { // returns {row: row, col: col} from various input formats, or {row: null, col: null}
	// NB the validity of the row and col is not checked, just that they are integer
		if (Number.isInteger(arg1) && Number.isInteger(arg2)) // (row, col) have been given
			return {row: arg1, col: arg2};
		if (typeof arg2 === 'undefined' && typeof arg1 !== 'undefined') {
			if (arg1.row && arg1.col) // if arg1 is an object with .row, .col properties - eg Move or Cell
				return {row: arg1.row, col: arg1.col};
			var c = parseInt(arg1.charCodeAt(0) - "a".charCodeAt(0) + 1); // eg b
			var r = parseInt(arg1.slice(1, arg1.length)); // eg 6, 12
			if (Number.isInteger(r) && Number.isInteger(c))
				return {row: r, col: c};
		}
		return {row: null, col: null};
	}	

	// exposing public functions ('classes')
    return {
		Game:	Game,
		Move:	Move,
		Cell:	Cell,
		EMPTY: EMPTY,
		BLACK:	BLACK,
		WHITE:	WHITE,
		setAppName: setAppName,
		getCellIDText: getCellIDText
    };

})();
