/**
 * FTP glob
 * @author morris
 */

var Stream = require( 'stream' );
var minimatch = require( 'minimatch' );
var Minimatch = minimatch.Minimatch;

module.exports = {

	glob: function( globs, options ) {

		options = this.makeOptions( options );

		var self = this;
		var positives = [];
		var negatives = [];
		globs.forEach( function( glob ) {

			var mm = new Minimatch( glob, options );
			mm.base = mmBase( mm );

			if ( mm.negate ) negatives.push( mm );
			else positives.push( mm );

		} );

		var stream = new Stream.PassThrough( { objectMode: true } );
		if ( !options.keep ) {

			var disconnect = this.disconnect.bind( this );
			stream.on( 'end', disconnect )
				.on( 'error', disconnect );

		}

		var scanning = 0;

		// get file list and write to stream on match.
		// recursively scan on partial match.
		function scan( path, mm ) {

			++scanning;
			self.mlsdOrList( path, onList );

			function onList( err, files ) {

				if ( err ) return stream.emit( 'error', err );

				files.forEach( function( file ) {

					write( file );

					if ( file.ftp.type === 'dir' && mm.match( file.path, true ) ) {

						scan( file.path, mm );

					}

				} );

				--scanning;

				if ( scanning === 0 ) stream.emit( 'end' );

			}

		}

		// get base path of minimatch instance
		function mmBase( mm ) {

			var first =  mm.set[ 0 ];

			PARTS: for ( var i = 0, l = first.length - 1; i < l; ++i ) {

				if ( typeof first[ i ] !== 'string' ) break PARTS;

				for ( var j = 1, k = mm.set.length; j < k; ++j ) {

					if ( mm.set[ j ][ i ] !== first[ i ] ) break PARTS;

				}

			}

			return first.slice( 0, i ).join( '/' );

		}

		// get base path of minimatch parts
		function partsBase( parts ) {

			for ( var i = 0, l = parts.length - 1; i < l; ++i ) {

				if ( typeof parts[ i ] !== 'string' ) break;

			}

			return parts.slice( 0, i ).join( '/' );

		}

		// write file on match. check it only once.
		var seen = {};

		function write( file ) {

			if ( !seen[ file.path ] ) {

				seen[ file.path ] = true;
				if ( match( file ) ) stream.write( file );

			}

		}

		function match( file ) {

			var ok = false;
			var base;
			var i, l;

			for ( i = 0, l = positives.length; i < l; ++i ) {

				if ( positives[ i ].match( file.path ) ) {

					ok = true;
					base = options.base || positives[ i ].base;
					break;

				}

			}

			if ( !ok ) return false;

			for ( i = 0, l = negatives.length; i < l; ++i ) {

				if ( !negatives[ i ].match( file.path ) ) return false;

			}

			if ( !ok ) return false;

			file.cwd = options.cwd || '/';
			file.base = base;
			console.log( file.base, file.path, file.relative );
			return true;

		}

		// scan each positive glob
		positives.forEach( function( mm ) {

			mm.set.forEach( function( parts ) {

				scan( partsBase( parts ), mm );

			} );

		} );

		return stream;

	}

};