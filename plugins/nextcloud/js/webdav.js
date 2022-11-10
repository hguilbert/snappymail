(rl => {

const
	nsDAV = 'DAV:',
	nsNC = 'http://nextcloud.org/ns',
	nsOC = 'http://owncloud.org/ns',
	nsOCS = 'http://open-collaboration-services.org/ns',
	nsCalDAV = 'urn:ietf:params:xml:ns:caldav',

	OC = () => parent.OC,

	// Nextcloud 19 deprecated generateUrl, but screw `import { generateUrl } from "@nextcloud/router"`
	generateUrl = path => OC().webroot + (OC().config.modRewriteWorking ? '' : '/index.php') + path,
	generateRemoteUrl = path => location.protocol + '//' + location.host + generateUrl(path),

//	shareTypes = {0 = user, 1 = group, 3 = public link}

	propfindFiles = `<?xml version="1.0"?>
<propfind xmlns="DAV:" xmlns:oc="${nsOC}" xmlns:ocs="${nsOCS}" xmlns:nc="${nsNC}">
	<prop>
		<oc:fileid/>
		<oc:size/>
		<resourcetype/>
		<getcontentlength/>

		<getcontenttype/>
		<oc:permissions/>
		<ocs:share-permissions/>
		<nc:share-attributes/>
		<oc:share-types/>
		<nc:is-encrypted/>
	</prop>
</propfind>`,
/*
<d:propstat>
	<d:prop>
		<d:getcontenttype>video/mp4</d:getcontenttype>
		<oc:permissions>RGDNVW</oc:permissions>
		<d:getcontentlength>3963036</d:getcontentlength>
		<ocs:share-permissions>19</ocs:share-permissions>
		<nc:share-attributes>[]</nc:share-attributes>
		<oc:share-types>
			<oc:share-type>3</oc:share-type>
		</oc:share-types>
	</d:prop>
	<d:status>HTTP/1.1 200 OK</d:status>
</d:propstat>
<d:propstat>
	<d:prop>
		<nc:is-encrypted/>
	</d:prop>
	<d:status>HTTP/1.1 404 Not Found</d:status>
</d:propstat>
*/

	propfindCal = `<?xml version="1.0"?>
<propfind xmlns="DAV:">
	<prop>
		<resourcetype/>
		<current-user-privilege-set/>
		<displayname/>
	</prop>
</propfind>`,

	xmlParser = new DOMParser(),
	pathRegex = /.*\/remote.php\/dav\/[^/]+\/[^/]+/g,

	getElementsByTagName = (parent, namespace, localName) => parent.getElementsByTagNameNS(namespace, localName),
	getDavElementsByTagName = (parent, localName) => getElementsByTagName(parent, nsDAV, localName),
	getDavElementByTagName = (parent, localName) => getDavElementsByTagName(parent, localName)?.item(0),
	getElementByTagName = (parent, localName) => +parent.getElementsByTagName(localName)?.item(0),

	davFetch = (mode, path, options) => {
		if (!OC().requestToken) {
			return Promise.reject(new Error('OC.requestToken missing'));
		}
		let cfg = rl.settings.get('Nextcloud');
		options = Object.assign({
			mode: 'same-origin',
			cache: 'no-cache',
			redirect: 'error',
			credentials: 'same-origin',
			headers: {}
		}, options);
		options.headers.requesttoken = OC().requestToken;
//		cfg.UID = document.head.dataset.user
		return fetch(cfg.WebDAV + '/' + mode + '/' + cfg.UID + path, options);
	},

	davFetchFiles = (path, options) => davFetch('files', path, options),

	createDirectory = path => davFetchFiles(path, { method: 'MKCOL' }),

	fetchFiles = path => {
		if (!OC().requestToken) {
			return Promise.reject(new Error('OC.requestToken missing'));
		}
		return davFetchFiles(path, {
			method: 'PROPFIND',
			headers: {
				'Content-Type': 'application/xml; charset=utf-8'
			},
			body: propfindFiles
		})
		.then(response => (response.status < 400) ? response.text() : Promise.reject(new Error({ response })))
		.then(text => {
			const
				elemList = [],
				responseList = getDavElementsByTagName(
					xmlParser.parseFromString(text, 'application/xml').documentElement,
					'response'
				);
			path = path.replace(/\/$/, '');
			for (let i = 0; i < responseList.length; ++i) {
				const
					e = responseList.item(i),
					elem = {
						name: decodeURIComponent(getDavElementByTagName(e, 'href').textContent
							.replace(pathRegex, '').replace(/\/$/, '')),
						isFile: false
					};
				if (getDavElementsByTagName(getDavElementByTagName(e, 'resourcetype'), 'collection').length) {
					// skip current directory
					if (elem.name === path) {
						continue;
					}
				} else {
					elem.isFile = true;
					elem.id = e.getElementsByTagNameNS(nsOC, 'fileid')?.item(0)?.textContent;
					elem.size = getDavElementByTagName(e, 'getcontentlength')?.textContent
						|| getElementByTagName(e, 'oc:size')?.textContent;
				}
				elemList.push(elem);
			}
			return Promise.resolve(elemList);
		});
	},

	buildTree = (view, parent, items, path) => {
		if (items.length) {
			items.forEach(item => {
				if (!item.isFile) {
					let li = document.createElement('li'),
						details = document.createElement('details'),
						summary = document.createElement('summary'),
						ul = document.createElement('ul');
					details.addEventListener('toggle', () => {
						ul.children.length
						|| fetchFiles(item.name).then(items => buildTree(view, ul, items, item.name));
					});
					summary.textContent = item.name.replace(/^.*\/([^/]+)$/, '$1');
					summary.dataset.icon = '📁';
					if (!view.files()) {
						let btn = document.createElement('button');
						btn.name = 'select';
						btn.textContent = 'select';
						btn.className = 'button-vue';
						btn.style.marginLeft = '1em';
						summary.append(btn);
						summary.item_name = item.name;
					}
					details.append(summary);
					details.append(ul);
//					a.append('- ' + item.name.replace(/^\/+/, ''));
					li.append(details);
					parent.append(li);
				}
			});
			if (view.files()) {
				items.forEach(item => {
					if (item.isFile) {
						let li = document.createElement('li'),
							btn = document.createElement('button');

						li.item = item;
						li.textContent = item.name.replace(/^.*\/([^/]+)$/, '$1');
						li.dataset.icon = '🗎';

						btn.name = 'select';
						btn.textContent = 'select';
						btn.className = 'button-vue';
						btn.style.marginLeft = '1em';
						li.append(btn);

						btn = document.createElement('button');
						btn.name = 'share-internal';
						btn.textContent = '🔗 internal';
						btn.className = 'button-vue';
						btn.style.marginLeft = '1em';
						li.append(btn);
/*
						btn = document.createElement('button');
						btn.name = 'share-public';
						btn.textContent = '🔗 public';
						btn.className = 'button-vue';
						btn.style.marginLeft = '1em';
						li.append(btn);
*/
						parent.append(li);
					}
				});
			}
		}
		if (!view.files()) {
			let li = document.createElement('li'),
				input = document.createElement('input'),
				btn = document.createElement('button');
			btn.name = 'create';
			btn.textContent = 'create & select';
			btn.className = 'button-vue';
			btn.input = input;
			li.item_path = path;
			li.append(input);
			li.append(btn);
			parent.append(li);
		}
	};

class NextcloudFilesPopupView extends rl.pluginPopupView {
	constructor() {
		super('NextcloudFiles');
		this.addObservables({
			files: false
		});
	}

	onBuild(dom) {
		this.tree = dom.querySelector('#sm-nc-files-tree');
		this.tree.addEventListener('click', event => {
			let el = event.target;
			if (el.matches('button')) {
				let parent = el.parentNode;
				if ('select' == el.name) {
					this.select = this.files() ? [parent.item] : parent.item_name;
					this.close();
				} else if ('share-internal' == el.name) {
					this.select = [{url:generateRemoteUrl(`/f/${parent.item.id}`)}];
					this.close();
				} else if ('share-public' == el.name) {
/*
					if (3 == share-type) {
						GET generateUrl(`/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json&path=${encodeURIComponent(parent.item.name)}&reshares=true`);
					} else {
						POST generateUrl(`/ocs/v2.php/apps/files_sharing/api/v1/shares`)
						> {"path":"/Nextcloud intro.mp4","shareType":3,"attributes":"[]"}
						< {"ocs":{"meta":{"status":"ok","statuscode":200,"message":"OK"},
							"data":{
								"id":"2",
								"share_type":3,
								"permissions":17,
								"token":"7GK9mL9LCTseSgK",
								"path":"\/Nextcloud intro.mp4",
								"item_type":"file",
								"mimetype":"video\/mp4",
								"storage":1,
								"item_source":20,
								"file_source":20,
								"file_parent":2,
								"file_target":"\/Nextcloud intro.mp4",
								"password":null,
								"url":"https:\/\/example.com\/index.php\/s\/7GK9mL9LCTseSgK",
								"mail_send":1,
								"hide_download":0,
								"attributes":null
							}}}
						GET /index.php/s/7GK9mL9LCTseSgK
						PUT /ocs/v2.php/apps/files_sharing/api/v1/shares/2
						> {"expireDate":"\"2022-11-29T23:00:00.000Z\""}
						> {"password":"ABC09"}
					}
*/
				} else if ('create' == el.name) {
					let name = el.input.value.replace(/[|\\?*<":>+[]\/&\s]/g, '');
					if (name.length) {
						name = parent.item_path + '/' + name;
						createDirectory(name).then(response => {
							if (response.status == 201) {
								this.select = name;
								this.close();
							}
						});
					}
				}
			}
		});
	}

	// Happens after showModal()
	beforeShow(files, fResolve) {
		this.select = '';
		this.files(!!files);
		this.fResolve = fResolve;

		this.tree.innerHTML = '';
		fetchFiles('/').then(items => {
			buildTree(this, this.tree, items, '/');
		}).catch(err => console.error(err))
	}

	onHide() {
		this.fResolve(this.select);
	}
/*
beforeShow() {} // Happens before showModal()
onShow() {}     // Happens after  showModal()
afterShow() {}  // Happens after  showModal() animation transitionend
onHide() {}     // Happens before animation transitionend
afterHide() {}  // Happens after  animation transitionend
close() {}
*/
}

class NextcloudCalendarsPopupView extends rl.pluginPopupView {
	constructor() {
		super('NextcloudCalendars');
	}

	onBuild(dom) {
		this.tree = dom.querySelector('#sm-nc-calendars');
		this.tree.addEventListener('click', event => {
			let el = event.target;
			if (el.matches('button')) {
				this.select = el.href;
				this.close();
			}
		});
	}

	// Happens after showModal()
	beforeShow(fResolve) {
		this.select = '';
		this.fResolve = fResolve;
		this.tree.innerHTML = '';
		davFetch('calendars', '/', {
			method: 'PROPFIND',
			headers: {
				'Content-Type': 'application/xml; charset=utf-8'
			},
			body: propfindCal
		})
		.then(response => (response.status < 400) ? response.text() : Promise.reject(new Error({ response })))
		.then(text => {
			const
				responseList = getDavElementsByTagName(
					xmlParser.parseFromString(text, 'application/xml').documentElement,
					'response'
				);
			for (let i = 0; i < responseList.length; ++i) {
				const e = responseList.item(i);
				if (getDavElementByTagName(e, 'resourcetype').getElementsByTagNameNS(nsCalDAV, 'calendar').length) {
//				 && getDavElementsByTagName(getDavElementByTagName(e, 'current-user-privilege-set'), 'write').length) {
					const li = document.createElement('li'),
						btn = document.createElement('button');
					li.dataset.icon = '📅';
					li.textContent = getDavElementByTagName(e, 'displayname').textContent;
					btn.href = getDavElementByTagName(e, 'href').textContent
						.replace(pathRegex, '').replace(/\/$/, '');
					btn.textContent = 'select';
					btn.className = 'button-vue';
					btn.style.marginLeft = '1em';
					li.append(btn);
					this.tree.append(li);
				}
			}
		})
		.catch(err => console.error(err));
	}

	onHide() {
		this.fResolve(this.select);
	}
/*
beforeShow() {} // Happens before showModal()
onShow() {}     // Happens after  showModal()
afterShow() {}  // Happens after  showModal() animation transitionend
onHide() {}     // Happens before animation transitionend
afterHide() {}  // Happens after  animation transitionend
close() {}
*/
}

rl.nextcloud = {
	selectCalendar: () =>
		new Promise(resolve => {
			NextcloudCalendarsPopupView.showModal([
				href => resolve(href),
			]);
		}),

	calendarPut: (path, event) => {
		// Validation error in iCalendar: A calendar object on a CalDAV server MUST NOT have a METHOD property.
		event = event.replace(/METHOD:.+\r?\n/i, '');

		let m = event.match(/UID:(.+)/);
		davFetch('calendars', path + '/' + m[1] + '.ics', {
			method: 'PUT',
			headers: {
				'Content-Type': 'text/calendar'
			},
			body: event
		})
		.then(response => (response.status < 400) ? response.text() : Promise.reject(new Error({ response })))
		.then(text => {
			console.dir({event_response:text});
		});
	},

	selectFolder: () =>
		new Promise(resolve => {
			NextcloudFilesPopupView.showModal([
				false,
				folder => resolve(folder),
			]);
		}),

	selectFiles: () =>
		new Promise(resolve => {
			NextcloudFilesPopupView.showModal([
				true,
				files => resolve(files),
			]);
		})
};

})(window.rl);
