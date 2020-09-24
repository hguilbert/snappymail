import ko from 'ko';

import { settingsSaveHelperSimpleFunction, defautOptionsAfterRender } from 'Common/Utils';

import { SaveSettingsStep, StorageResultType } from 'Common/Enums';
import Remote from 'Remote/Admin/Fetch';
import { command } from 'Knoin/Knoin';

const settingsGet = rl.settings.get;

class ContactsAdminSettings {
	constructor() {
		this.defautOptionsAfterRender = defautOptionsAfterRender;
		this.enableContacts = ko.observable(!!settingsGet('ContactsEnable'));
		this.contactsSync = ko.observable(!!settingsGet('ContactsSync'));

		const supportedTypes = settingsGet('supportedPdoDrivers') || [],
			types = [{
				id:'sqlite',
				name:'SQLite'
			},{
				id:'mysql',
				name:'MySQL'
			},{
				id:'pgsql',
				name:'PostgreSQL'
			}].filter(type => supportedTypes.includes(type.id));

		this.contactsSupported = 0 < types.length;

		this.contactsTypesOptions = types;

		this.contactsType = ko.observable('');

		this.mainContactsType = ko
			.computed({
				read: this.contactsType,
				write: (value) => {
					if (value !== this.contactsType()) {
						if (supportedTypes.includes(value)) {
							this.contactsType(value);
						} else if (types.length) {
							this.contactsType('');
						}
					} else {
						this.contactsType.valueHasMutated();
					}
				}
			})
			.extend({ notify: 'always' });

		this.contactsType.subscribe(() => {
			this.testContactsSuccess(false);
			this.testContactsError(false);
			this.testContactsErrorMessage('');
		});

		this.pdoDsn = ko.observable(settingsGet('ContactsPdoDsn'));
		this.pdoUser = ko.observable(settingsGet('ContactsPdoUser'));
		this.pdoPassword = ko.observable(settingsGet('ContactsPdoPassword'));

		this.pdoDsnTrigger = ko.observable(SaveSettingsStep.Idle);
		this.pdoUserTrigger = ko.observable(SaveSettingsStep.Idle);
		this.pdoPasswordTrigger = ko.observable(SaveSettingsStep.Idle);
		this.contactsTypeTrigger = ko.observable(SaveSettingsStep.Idle);

		this.testing = ko.observable(false);
		this.testContactsSuccess = ko.observable(false);
		this.testContactsError = ko.observable(false);
		this.testContactsErrorMessage = ko.observable('');

		this.contactsType(settingsGet('ContactsPdoType'));

		this.onTestContactsResponse = this.onTestContactsResponse.bind(this);
	}

	@command((self) => self.pdoDsn() && self.pdoUser())
	testContactsCommand() {
		this.testContactsSuccess(false);
		this.testContactsError(false);
		this.testContactsErrorMessage('');
		this.testing(true);

		Remote.testContacts(this.onTestContactsResponse, {
			'ContactsPdoType': this.contactsType(),
			'ContactsPdoDsn': this.pdoDsn(),
			'ContactsPdoUser': this.pdoUser(),
			'ContactsPdoPassword': this.pdoPassword()
		});
	}

	onTestContactsResponse(result, data) {
		this.testContactsSuccess(false);
		this.testContactsError(false);
		this.testContactsErrorMessage('');

		if (StorageResultType.Success === result && data && data.Result && data.Result.Result) {
			this.testContactsSuccess(true);
		} else {
			this.testContactsError(true);
			if (data && data.Result) {
				this.testContactsErrorMessage(data.Result.Message || '');
			} else {
				this.testContactsErrorMessage('');
			}
		}

		this.testing(false);
	}

	onShow() {
		this.testContactsSuccess(false);
		this.testContactsError(false);
		this.testContactsErrorMessage('');
	}

	onBuild() {
		setTimeout(() => {
			const f1 = settingsSaveHelperSimpleFunction(this.pdoDsnTrigger, this),
				f3 = settingsSaveHelperSimpleFunction(this.pdoUserTrigger, this),
				f4 = settingsSaveHelperSimpleFunction(this.pdoPasswordTrigger, this),
				f5 = settingsSaveHelperSimpleFunction(this.contactsTypeTrigger, this);

			this.enableContacts.subscribe((value) => {
				Remote.saveAdminConfig(null, {
					'ContactsEnable': value ? '1' : '0'
				});
			});

			this.contactsSync.subscribe((value) => {
				Remote.saveAdminConfig(null, {
					'ContactsSync': value ? '1' : '0'
				});
			});

			this.contactsType.subscribe((value) => {
				Remote.saveAdminConfig(f5, {
					'ContactsPdoType': value.trim()
				});
			});

			this.pdoDsn.subscribe((value) => {
				Remote.saveAdminConfig(f1, {
					'ContactsPdoDsn': value.trim()
				});
			});

			this.pdoUser.subscribe((value) => {
				Remote.saveAdminConfig(f3, {
					'ContactsPdoUser': value.trim()
				});
			});

			this.pdoPassword.subscribe((value) => {
				Remote.saveAdminConfig(f4, {
					'ContactsPdoPassword': value.trim()
				});
			});

			this.contactsType(settingsGet('ContactsPdoType'));
		}, 50);
	}
}

export { ContactsAdminSettings, ContactsAdminSettings as default };
