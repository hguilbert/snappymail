import ko from 'ko';

import PgpStore from 'Stores/User/Pgp';

import { popup, command } from 'Knoin/Knoin';
import { AbstractViewNext } from 'Knoin/AbstractViewNext';

@popup({
	name: 'View/Popup/AddOpenPgpKey',
	templateID: 'PopupsAddOpenPgpKey'
})
class AddOpenPgpKeyPopupView extends AbstractViewNext {
	constructor() {
		super();

		this.key = ko.observable('');
		this.key.error = ko.observable(false);
		this.key.errorMessage = ko.observable('');

		this.key.subscribe(() => {
			this.key.error(false);
			this.key.errorMessage('');
		});
	}

	@command()
	addOpenPgpKeyCommand() {
		// eslint-disable-next-line max-len
		const reg = /[-]{3,6}BEGIN[\s]PGP[\s](PRIVATE|PUBLIC)[\s]KEY[\s]BLOCK[-]{3,6}[\s\S]+?[-]{3,6}END[\s]PGP[\s](PRIVATE|PUBLIC)[\s]KEY[\s]BLOCK[-]{3,6}/gi,
			openpgpKeyring = PgpStore.openpgpKeyring;

		let keyTrimmed = this.key().trim();

		if (/[\n]/.test(keyTrimmed)) {
			keyTrimmed = keyTrimmed.replace(/[\r]+/g, '').replace(/[\n]{2,}/g, '\n\n');
		}

		this.key.error(!keyTrimmed);
		this.key.errorMessage('');

		if (!openpgpKeyring || this.key.error()) {
			return false;
		}

		let match = null,
			count = 30,
			done = false;

		do {
			match = reg.exec(keyTrimmed);
			if (match && 0 < count) {
				if (match[0] && match[1] && match[2] && match[1] === match[2]) {
					let err = null;
					if ('PRIVATE' === match[1]) {
						err = openpgpKeyring.privateKeys.importKey(match[0]);
					} else if ('PUBLIC' === match[1]) {
						err = openpgpKeyring.publicKeys.importKey(match[0]);
					}

					if (err) {
						this.key.error(true);
						this.key.errorMessage(err && err[0] ? '' + err[0] : '');
						console.log(err);
					}
				}

				--count;
				done = false;
			} else {
				done = true;
			}
		} while (!done);

		openpgpKeyring.store();

		rl.app.reloadOpenPgpKeys();

		if (this.key.error()) {
			return false;
		}

		this.cancelCommand && this.cancelCommand();
		return true;
	}

	clearPopup() {
		this.key('');
		this.key.error(false);
		this.key.errorMessage('');
	}

	onShow() {
		this.clearPopup();
	}
}

export { AddOpenPgpKeyPopupView, AddOpenPgpKeyPopupView as default };
