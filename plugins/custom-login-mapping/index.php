<?php

class CustomLoginMappingPlugin extends \RainLoop\Plugins\AbstractPlugin
{
	const
		NAME = 'Custom Login Mapping',
		VERSION = '2.2',
		RELEASE = '2024-09-20',
		REQUIRED = '2.36.1',
		CATEGORY = 'Login',
		DESCRIPTION = 'Enables custom usernames by email address.';

	public function Init() : void
	{
		$this->addHook('login.credentials', 'FilterLoginCredentials');
	}

	/**
	 * @param string $sEmail
	 * @param string $sImapUser
	 * @param string $sPassword
	 * @param string $sSmtpUser
	 *
	 * @throws \RainLoop\Exceptions\ClientException
	 */
	public function FilterLoginCredentials(string &$sEmail, string &$sImapUser, string &$sPassword, string &$sSmtpUser)
	{
		$sMapping = \trim($this->Config()->Get('plugin', 'mapping', ''));
		if (!empty($sMapping)) {
			$aLines = \explode("\n", \preg_replace('/[\r\n\t\s]+/', "\n", $sMapping));
			foreach ($aLines as $sLine) {
				if (false !== \strpos($sLine, ':')) {
					$aData = \explode(':', $sLine, 2);
					if (\is_array($aData) && !empty($aData[0]) && isset($aData[1])) {
						$aData = \array_map('trim', $aData);
						if ($sEmail === $aData[0]) {
							if (\strlen($aData[1])) {
								$sImapUser = $aData[1];
							}
							if (isset($aData[2]) && \strlen($aData[2])) {
								$sSmtpUser = $aData[2];
							}
						}
					}
				}
			}
		}
	}

	protected function configMapping() : array
	{
		return array(
			\RainLoop\Plugins\Property::NewInstance('mapping')->SetLabel('Mapping')
				->SetType(\RainLoop\Enumerations\PluginPropertyType::STRING_TEXT)
				->SetDescription('email:imap-login:smtp-login mapping')
				->SetDefaultValue("user@domain.com:imapuser.bob:smtpuser.bob\nadmin@domain.com:imapuser.john")
		);
	}
}
