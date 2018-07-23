(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define('Cyrup', factory) :
	(global.Cyrup = factory());
}(this, (function () { 'use strict';

	/*
	async hashPassword (password, data) {
		const self = this;

		data = data || {};
		data.rounds = data.rounds || self.ROUNDS;
		data.encoding = data.encoding || self.ENCODING;
		data.hashType = data.hashType || self.HASH_TYPE;
		data.hashBytes = data.hashBytes || self.HASH_BYTES;
		data.saltBytes = data.saltBytes || self.SALT_BYTES;

		const salt = await self.randomBytes(data.saltBytes);
		const hash = await self.pbkdf2(password, salt, data.rounds, data.hashBytes, data.hashType);

		const buffer = Buffer.alloc(hash.length + salt.length + 8);

		// include salt length to figure out how much of the hash is salt
		buffer.writeUInt32BE(salt.length, 0, true);
		buffer.writeUInt32BE(data.rounds, 4, true);

		salt.copy(buffer, 8);
		hash.copy(buffer, salt.length + 8);

		return buffer.toString(data.encoding);
	},

	async comparePassword (password, combined, data) {
		const self = this;

		data = data || {};
		data.encoding = data.encoding || self.ENCODING;
		data.hashType = data.hashType || self.HASH_TYPE;

		combined = Buffer.from(combined, data.encoding);

		// extract the salt from the buffer
		const saltBytes = combined.readUInt32BE(0);
		const hashBytes = combined.length - saltBytes - 8;
		const rounds = combined.readUInt32BE(4);

		const salt = combined.slice(8, saltBytes + 8);
		const hash = combined.toString('binary', saltBytes + 8);

		const verify = await self.pbkdf2(password, salt, rounds, hashBytes, data.hashType);

		return verify.toString('binary') === hash;
	},
	*/

	const Cyrup = {

		ENCODING: 'hex',
		ITERATIONS: 99999,

		TAG_BYTES: 16,
		KEY_BYTES: 32,
		SALT_BYTES: 16,
		VECTOR_BYTES: 12,
		SECRET_BYTES: 48,

		HASH: 'sha-512',
		ALGORITHM: 'aes-256-gcm',

		normalizeBytes (algorithm) {
			const self = this;

			if (typeof algorithm === 'number') return algorithm;
			if (algorithm.toLowerCase().indexOf('aes') !== 0) return self.KEY_BYTES;

			const algorithms = algorithm.split('-');
			const bits = parseInt(algorithms[1]);

			return bits === NaN ? self.KEY_BYTES * 8 : bits / 8;
		},

		random (data) {
			const self = this;

			data = data || {};

			return Promise.resolve().then(function () {
				return self.randomBytes(data.bytes);
			}).then(function (buffer) {
				return self.bufferToHex(buffer);
			});
		},

		secret (data) {
			const self = this;

			data = data || {};
			data.bytes = data.bytes || self.SECRET_BYTES;

			return Promise.resolve().then(function () {
				return self.randomBytes(data.bytes);
			}).then(function (buffer) {
				return self.bufferToHex(buffer);
			});
		},

		hash (data) {
			const self = this;

			if (!data.item) throw new Error('item required');

			data = data || {};
			data.hash = data.hash || self.HASH;
			data.hash = self.normalizeHash(data.hash);

			return Promise.resolve().then(function () {
				return self.stringToBuffer(data.item);
			}).then(function (buffer) {
				return self.createHash(buffer, data.hash);
			}).then(function (buffer) {
				return self.bufferToHex(buffer);
			});
		},

		key (data) {
			const self = this;

			data = data || {};

			if (!data.item) throw new Error('item required');

			data.hash = data.hash || self.HASH;
			data.algorithm = data.algorithm || self.ALGORITHM;
			data.bytes = data.bytes || data.algorithm;

			data.iterations = data.iterations || self.ITERATIONS;
			data.saltBytes = data.saltBytes || self.SALT_BYTES;
			data.vectorBytes = data.vectorBytes || self.VECTOR_BYTES;

			data.hash = self.normalizeHash(data.hash);
			data.bytes = self.normalizeBytes(data.bytes);
			data.algorithm = self.normalizeAlgorithm(data.algorithm);

			let salt, item;

			return Promise.all([
				self.stringToBuffer(data.item),
				self.randomBytes(data.saltBytes)
			]).then(function (results) {
				item = results[0];
				salt = results[1];
				return self.pbkdf2(item, salt, data.iterations, data.bytes, data.hash, data.algorithm);
			}).then(function (key) {
				return {
					item: key,
					algorithm: data.algorithm,
					vectorBytes: data.vectorBytes
				};
			});
		},

		encrypt (data) {
			const self = this;

			data = data || {};

			if (!data.key) throw new Error('key required');
			if (!data.item) throw new Error('item required');

			let vector, item;

			return Promise.all([
				self.stringToBuffer(data.item),
				self.randomBytes(data.key.vectorBytes)
			]).then(function (results) {
				item = results[0];
				vector = results[1];
				return self.cipher(data.key.algorithm, data.key.item, vector, item);
			}).then(function (encrypted) {
				return Promise.all([
					self.bufferToHex(encrypted),
					self.bufferToHex(vector)
				]).then(function (results) {
					return results.join(':');
				});
			});
		},

		decrypt (data) {
			const self = this;

			data = data || {};

			if (!data.key) throw new Error('key required');
			if (!data.item) throw new Error('item required');

			const items = data.item.split(':');

			let item, vector;

			return Promise.all([
				self.hexToBuffer(items[0]),
				self.hexToBuffer(items[1])
			]).then(function (results) {
				item = results[0];
				vector = results[1];
				return self.decipher(data.key.algorithm, data.key.item, vector, item);
			}).then(function (decrypted) {
				return self.bufferToString(decrypted);
			});
		}

	};

	if (typeof window === 'undefined') {

		const Util = require('util');
		const Crypto = require('crypto');
		const Pbkdf2 = Util.promisify(Crypto.pbkdf2);
		const RandomBytes = Util.promisify(Crypto.randomBytes);

		Cyrup.normalizeHash = function (hash) {
			return hash.replace('-', '').toLowerCase();
		};

		Cyrup.normalizeAlgorithm = function (algorithm) {
			if (algorithm.toLowerCase().indexOf('aes') !== 0) return algorithm;
			return algorithm.toLowerCase();
		};

		Cyrup.hexToBuffer = async function (hex) {
			return Buffer.from(hex, 'hex');
		};

		Cyrup.bufferToHex = async function (buffer) {
			return buffer.toString('hex');
		};

		Cyrup.stringToBuffer = async function (string) {
			return Buffer.from(string, 'utf8');
		};

		Cyrup.bufferToString = async function (buffer) {
			return buffer.toString('utf8');
		};

		Cyrup.createHash = async function (buffer, type) {
			return Crypto.createHash(type).update(buffer).digest();
		};

		Cyrup.randomBytes = async function (bytes) {
			return RandomBytes(bytes);
		};

		Cyrup.pbkdf2 = async function (password, salt, iterations, bytes, hash) {
			return Pbkdf2(password, salt, iterations, bytes, hash);
		};

		Cyrup.cipher = async function (algorithm, key, vector, data) {
			const self = this;
			const cipher = Crypto.createCipheriv(algorithm, key, vector);
			return Buffer.concat([cipher.update(data, 'utf8'), cipher.final(), cipher.getAuthTag()]);
		};

		Cyrup.decipher = async function (algorithm, key, vector, data) {
			const self = this;
			const buffer = Buffer.from(data, 'hex');
			const tag = buffer.slice(buffer.byteLength - self.TAG_BYTES);
			const text = buffer.slice(0, buffer.byteLength - self.TAG_BYTES);
			const decipher = Crypto.createDecipheriv(algorithm, key, vector);

			decipher.setAuthTag(tag);

			return Buffer.concat([decipher.update(text), decipher.final()]);
		};

	} else {

		Cyrup.normalizeHash = function (hash) {
			return hash.toUpperCase();
		};

		Cyrup.normalizeAlgorithm = function (algorithm) {
			if (algorithm.toLowerCase().indexOf('aes') !== 0) return algorithm;
			const algorithms = algorithm.split('-');
			return (algorithms[0] + '-' + algorithms[2]).toUpperCase();
		};

		Cyrup.getAuthTag = function (encrypted) {
			return encrypted.slice(encrypted.byteLength - this.TAG_BYTES);
		};

		Cyrup.hexToBuffer = function (hex) {
			return Promise.resolve().then(function () {

				if (typeof hex !== 'string') {
					throw new TypeError('Expected input to be a string');
				}

				if ((hex.length % 2) !== 0) {
					throw new RangeError('Expected string to be an even number of characters');
				}

				const bytes = new Uint8Array(hex.length / 2);

				for (let i = 0, l = hex.length; i < l; i += 2) {
					bytes[i/2] = parseInt( hex.substring(i, i + 2), 16 );
				}

				return bytes.buffer
			});
		};

		Cyrup.bufferToHex = function (buffer) {
			return Promise.resolve().then(function () {
				const bytes = new Uint8Array(buffer);
			 	const hex = new Array(bytes.length);

				for (let i = 0, l = bytes.length; i < l; i++) {
					hex[i] = ( '00' + bytes[i].toString(16) ).slice(-2);
				}

				return hex.join('');
			});
		};

		Cyrup.stringToBuffer = function (string) {
			return Promise.resolve().then(function () {
				const bytes = new Uint8Array(string.length);

				for (let i = 0, l = string.length; i < l; i++) {
					bytes[i] = string.charCodeAt(i);
				}

				return bytes.buffer
			});
		};

	    Cyrup.bufferToString = function (buffer) {
			return Promise.resolve().then(function () {
				const bytes = new Uint8Array(buffer);
				const string = new Array(bytes.length);

		        for (let i = 0, l = bytes.length; i < l; i++) {
					string[i] = String.fromCharCode(bytes[i]);
		        }

		        return string.join('');
			});
	    };

		Cyrup.createHash = function (buffer, type) {
			return Promise.resolve().then(function () {
				return window.crypto.subtle.digest(type, buffer);
			});
		};

		Cyrup.randomBytes = function (size) {
			return Promise.resolve().then(function () {
				return window.crypto.getRandomValues(new Uint8Array(size));
			});
		};

		Cyrup.pbkdf2 = function (password, salt, iterations, bytes, hash, algorithm) {
			const self = this;
			return Promise.resolve().then(function () {
				if (!salt) throw new Error('salt required');
				if (!hash) throw new Error('hash required');
				if (!bytes) throw new Error('bytes required');
				if (!password) throw new Error('password required');
				if (!algorithm) throw new Error('algorithm required');
				if (!iterations) throw new Error('iterations required');
			}).then(function () {
				return window.crypto.subtle.importKey('raw', password, { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']);
			}).then(function (key) {
				return window.crypto.subtle.deriveKey({
					salt,
					hash,
					iterations,
					name: 'PBKDF2'
				}, key, {
					name: algorithm,
					length: bytes * 8,
					tagLength: self.TAG_BYTES * 8
				}, false, ['encrypt', 'decrypt']);
			});
		};

		Cyrup.cipher = function (algorithm, key, vector, data) {
			return Promise.resolve().then(function () {
				return window.crypto.subtle.encrypt({ name: algorithm, iv: vector }, key, data);
			});
		};

		Cyrup.decipher = function (algorithm, key, vector, data) {
			return Promise.resolve().then(function () {
				return window.crypto.subtle.decrypt({ name: algorithm, iv: vector }, key, data);
			});
		};

	}

	return Cyrup;

})));