'use strict';

/**
 * This module is used to generate object model and component validation classes in browser-friendly ES6 JavaScript
 */
module.exports = {

	/**
	 * return {string} Code to inject into the NewgroundsIO_objects_Session constructor
	 */
	getConstructorPartial: function() 
	{
		var out = 			"\n";

		out +=				"			/**\n";
		out +=				"			 * The current state of this session.\n";
		out +=				"			 * @private\n";
		out +=				"			 */\n";
		out +=				"			this._status = NewgroundsIO.SessionState.SESSION_UNINITIALIZED;\n\n";

		out +=				"			/**\n";
		out +=				"			 * The status from the last time update() was called.\n";
		out +=				"			 * @private\n";
		out +=				"			 */\n";
		out +=				"			this._lastStatus = null;\n\n";

		out +=				"			/**\n";
		out +=				"			 * Will be true if the status was changed on an update call.\n";
		out +=				"			 * @private\n";
		out +=				"			 */\n";
		out +=				"			this._statusChanged = false;\n\n";

		out +=				"			/**\n";
		out +=				"			 * The last time update() was called. (Start in the past so update() will work immediately.)\n";
		out +=				"			 * @private\n";
		out +=				"			 */\n";
		out +=				"			this._lastUpdate = new Date((new Date()).getTime() - 30000);\n\n";

		out +=				"			/**\n";
		out +=				"			 * If false, update() will end immediately when called.\n";
		out +=				"			 * @private\n";
		out +=				"			 */\n";
		out +=				"			this._canUpdate = true;\n\n";

		out +=				"			/**\n";
		out +=				"			 * The mode we'll use to check the status of this session.\n";
		out +=				"			 * @private\n";
		out +=				"			 */\n";
		out +=				"			this._mode = \"expired\";\n\n";

		out +=				"			/**\n";
		out +=				"			 * The total number of attempts we've tried to contact the server without success.\n";
		out +=				"			 * @private\n";
		out +=				"			 */\n";
		out +=				"			this._totalAttempts = 0;\n\n";

		out +=				"			/**\n";
		out +=				"			 * TThe max number of attempts we can make to the server without success before we give up.\n";
		out +=				"			 * @private\n";
		out +=				"			 */\n";
		out +=				"			this._maxAttempts = 5;\n\n";

		out +=				"			/**\n";
		out +=				"			 * Stores a session ID from the game's URI if hosted on Newgrounds.\n";
		out +=				"			 * @private\n";
		out +=				"			 */\n";
		out +=				"			this._uri_id = null;\n\n";

		out +=				"			/**\n";
		out +=				"			 * Stores a session ID that was saved from a Passport login.\n";
		out +=				"			 * @private\n";
		out +=				"			 */\n";
		out +=				"			this._saved_id = null;\n\n";

		return out;
	},

	/**
	 * return {string} Code to inject into the overall NewgroundsIO_objects_Session class
	 */
	getClassPartial: function() 
	{
		var out = `
		/**
		 * @callback responseCallback
		 * @param {NewgroundsIO.objects.Response} serverResponse
		 */


		/**
		 * The current state of this session.
		 * @type {string}
		 */
		get status()
		{
			return this._status;
		}

		/**
		 * Will be true if the session state changed the last time update() was called.
		 * @type {boolean}
		 */
		get statusChanged()
		{
			return this._statusChanged;
		}

		/**
		 * Will be true if the current state is one where we are waiting for something to happen.
		 * @type {boolean}
		 */
		get waiting()
		{
			return this._lastStatus != this.status;
		}

		/**
		 * The localStorage key used to save a session id.
		 * @type {boolean}
		 */
		get storageKey()
		{
			return this.__ngioCore ? "_ngio_" + this.__ngioCore.appID + "_session_" : null;
		}

		/**
		 * resets everything except the session id.
		 * @private
		 */
		resetSession()
		{
			this._uri_id = null;
			this._saved_id = null;
			this.remember = false;
			this.user = null;
			this.expired = false;

			localStorage.setItem(this.storageKey, null);
		}

		/**
		 * Opens the Newgrounds Passport login page in a new browser tab.
		 */
		openLoginPage()
		{
			if (!this.passport_url) {
				console.warn("Can't open passport without getting a valis session first.");
				return;
			}

			this._status = NewgroundsIO.SessionState.WAITING_FOR_USER;
			this.mode = "check";

			window.open(this.passport_url, "_blank");
		}

		/**
		 * Logs the user out of their current session, locally and on the server, then calls a function when complete.
		 * @param {responseCallback} callback The callback function.
		 * @param {object} thisArg An optional object to use as 'this' in your callback function.
		 */
		logOut(callback, thisArg)
		{
			this.mode = "wait";
			this.endSession(callback, thisArg);
		}

		/**
		 * Cancels a pending login attempt.
		 * @param {function} newStatus An optional status code to use if LOGIN_CANCELLED is insufficient.
		 */
		cancelLogin(newStatus)
		{
			this.endSession();
			if (typeof(newStatus) === "undefined") newStatus = NewgroundsIO.SessionState.LOGIN_CANCELLED;

			// clear the current session data, and set the appropriate cancel status
			this.resetSession();
			this.id = null;
			this._status = newStatus;

			// this was a manual cancel, so we can reset the retry counter
			this._totalAttempts = 0;

			// this was a manual cancel, so we can reset the retry counter
			this._mode = "new";
			this._lastUpdate = new Date((new Date()).getTime() - 30000);
		}

		/**
		 * @callback updateCallback
		 * @param {string} status
		 */

		/**
		 * Call this to update the session process and call a function if there are any changes.
		 * @param {updateCallback} callback The callback function.
		 * @param {object} thisArg An optional object to use as 'this' in your callback function.
		 */
		update(callback, thisArg)
		{
			this._statusChanged = false;

			if (this._lastStatus != this.status) {
				this._statusChanged = true;
				this._lastStatus = this.status;
				if (typeof(callback) === "function") {
					if (thisArg) callback.call(thisArg, this);
					else callback(this);
				}
			}

			// we can skip this whole routine if we're in the middle of checking things
			if (!this._canUpdate || this.mode == "wait") return;
			if (!this.__ngioCore) {
				console.error("NewgroundsIO - Can't update session without attaching a NewgroundsIO.Core instance.");
				this._canUpdate = false;
				return;
			}

			// Server is not responding as expected, it may be down...  We'll set the session back to unintialized and try again
			if (this.status == NewgroundsIO.SessionState.SERVER_UNAVAILABLE) {
				
				// we've had too many failed attempts, time to stop retrying
				if (this._totalAttempts >= this._maxAttempts) {
					this._status = NewgroundsIO.SessionState.EXCEEDED_MAX_ATTEMPTS;

				// next time our delay time has passed, we'll reset this, and try our sessions again
				} else {
					this._status = NewgroundsIO.SessionState.SESSION_UNINITIALIZED;
					this._totalAttempts++;

				}
			}

			// first time getting here (probably).  We need to see if we have any existing session data to try...
			if (this.status == NewgroundsIO.SessionState.SESSION_UNINITIALIZED) {

				this._saved_id = localStorage.getItem(this.storageKey);

				// check if we have a session id from our URL params (hosted on Newgrounds)
				if (this._uri_id) {
					this.id = this._uri_id;

				// check if we have a saved session (hosted elsewhere or standalone app)
				} else if (this._saved_id) {
					this.id = this._saved_id;

				}

				// If we have an existing session, we'll use "check" mode to varify it, otherwise we'll nequest a "new" one.
				this.mode = this.id && this.id !== "null" ? "check" : "new";

			}

			// make sure at least 5 seconds pass between each API call so we don't get blocked by DDOS protection.
			var _now = new Date();
			var wait = _now - this._lastUpdate;
			if (wait < 5000) return;

			this._lastUpdate = _now;
			
			switch (this.mode) {

				// we don't have an existing session, so we're requesting a new one
				case "new":

					// change our mode to wait so the coroutine can finish before we make ny other API calls
					this.mode = "wait";
					this.startSession();
					break;

				// we have a session, we just need to check and see if there's a valid login attached to it
				case "check":

					// change our mode to wait so the coroutine can finish before we make ny other API calls
					this.mode = "wait";
					this.checkSession();
					break;
			}
		}

		// =================================== API CALLS/HANDLERS =================================== //


		/* App.startSession */

		/**
		 * This will reset our current session object, then make the API call to get a new session.
		 */
		startSession()
		{
			// don't check for any new updates while we're starting the new session
			this._canUpdate = false;
			
			// clear out any pre-existing session data
			this.resetSession();

			this._status = NewgroundsIO.SessionState.WAITING_FOR_SERVER;

			var startSession = this.__ngioCore.getComponent('App.startSession');
			this.__ngioCore.executeComponent(startSession, this._onStartSession, this);
		}

		/**
		 * Handles the acquisition of a new session id from the server.
		 * @private
		 */
		_onStartSession(response)
		{

			// The start session request was successful!
			if (response.success === true) {

				let result = response.result;

				if (Array.isArray(result)) {
					for(let i=0; i<result.length; i++) {
						if (result[i] && result[i].__object && result[i].__object == "App.startSession") {
							result = result[i];
							break;
						}
					}
				}

				// save the new session data to this session object
				this.id = result.session.id;
				this.passport_url = result.session.passport_url;

				// update our session status. This will trigger the callback in our update loop.
				this._status = NewgroundsIO.SessionState.LOGIN_REQUIRED;

				// The update loop needs to wait until the user clicks a login button
				this.mode = "wait";
				
			// Something went wrong!  (Good chance the servers are down)
			} else {
				this._status = NewgroundsIO.SessionState.SERVER_UNAVAILABLE;
			}

			// Let our update loop know it can actually do stuff again
			this._canUpdate = true;
		}


		/* App.checkSession */

		/**
		 * This will call the API to see what the status of our current session is
		 */
		checkSession()
		{
			// don't check for any new updates while we're checking session
			this._canUpdate = false;

			var checkSession = this.__ngioCore.getComponent('App.checkSession');
			this.__ngioCore.executeComponent(checkSession, this._onCheckSession, this);
		}

		/**
		 * Handles the response to checkSession. This may lead to a change in status if the user has signed in, 
		 * cancelled, or the session has expired.
		 * @private
		 */
		_onCheckSession(response)
		{
			// The API request was successful 
			if (response.success === true) {

				// Our session either failed, or the user cancelled the login on the server.
				if (!response.result.success) {

					// clear our id, and cancel the login attempt
					this.id = null;
					this.cancelLogin(response.result.error.code === 111 ? NewgroundsIO.SessionState.LOGIN_CANCELLED : NewgroundsIO.SessionState.LOGIN_FAILED);
					
				} else {
					// The session is expired
					if (response.result.session.expired) {

						// reset the session so it's like we never had one
						this.resetSession();
						this.id = null;
						this._status = NewgroundsIO.SessionState.SESSION_UNINITIALIZED;

					// we have a valid user login attached!
					} else if (response.result.session.user !== null) {

						// store the user info, and update status
						this.user = response.result.session.user;
						this._status = NewgroundsIO.SessionState.LOGIN_SUCCESSFUL;
						this.mode = "valid";

						// if the user selected to remember the login, save it now!
						if (response.result.session.remember) {
							this._saved_id = this.id;
							this.remember = true;
							localStorage.setItem(this.storageKey, this.id);
						}

					// Nothing has changed, we'll have to check again in the next loop.
					} else {
						this.mode = "check";
					}
				}

			} else {

				// Something went wrong!  Servers may be down, or you got blocked for sending too many requests
				this._status = NewgroundsIO.SessionState.SERVER_UNAVAILABLE;

			}

			// Let our update loop know it can actually do stuff again
			this._canUpdate = true;
		}


		/* App.endSession */

		/**
		 * This will end the current session on the server
		 * @param {responseCallback} callback The callback function.
		 * @param {object} thisArg An optional object to use as 'this' in your callback function.
		 */
		endSession(callback, thisArg)
		{
			// don't check for any new updates while we're ending session
			this._canUpdate = false;

			var endSession = this.__ngioCore.getComponent('App.endSession');
			var startSession = this.__ngioCore.getComponent('App.startSession');

			this.__ngioCore.queueComponent(endSession);
			this.__ngioCore.queueComponent(startSession);

			this.__ngioCore.executeQueue(function(response) {
				this._onEndSession(response);
				this._onStartSession(response);
				if (typeof(callback) === "function") {
					if (thisArg) callback.call(thisArg, this);
					else callback(this);
				}
			}, this);

			/*
			this.__ngioCore.executeComponent(endSession, function(response) {
				this._onEndSession(response);
				if (typeof(callback) === "function") {
					if (thisArg) callback.call(thisArg, this);
					else callback(this);
				}
			}, this);
			*/
		}

		/**
		 * Handler for endSession. Resets the session locally
		 * @private
		 */
		_onEndSession(response)
		{
			// We'll just clear out the whole session, even if something failed.
			this.resetSession();
			this.id = null;
			this.user = null;
			this.passport_url = null;
			this.mode = "new";
			this._status = NewgroundsIO.SessionState.USER_LOGGED_OUT;

			// Let our update loop know it can actually do stuff again
			this._canUpdate = true;
		}

		`;

		return out;
	}
}