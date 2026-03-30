from unittest.mock import patch

from mashora.addons.mail.tests.common import MailCommon
from mashora.addons.test_mail.tests.common import TestRecipients
from mashora.tests import tagged
from mashora.tools import mute_logger


@tagged("mashorabot")
class TestMashorabot(MailCommon, TestRecipients):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_record = cls.env['mail.test.simple'].with_context(cls._test_context).create({'name': 'Test', 'email_from': 'ignasse@example.com'})

        cls.mashorabot = cls.env.ref("base.partner_root")
        cls.message_post_default_kwargs = {
            'body': '',
            'attachment_ids': [],
            'message_type': 'comment',
            'partner_ids': [],
            'subtype_xmlid': 'mail.mt_comment'
        }
        cls.mashorabot_ping_body = f'<a href="http://mashora.com/mashora/res.partner/{cls.mashorabot.id}" class="o_mail_redirect" data-oe-id="{cls.mashorabot.id}" data-oe-model="res.partner" target="_blank">@MashoraBot</a>'
        cls.test_record_employe = cls.test_record.with_user(cls.user_employee)

    @mute_logger('mashora.addons.mail.models.mail_mail')
    def test_fetch_listener(self):
        channel = self.user_employee.with_user(self.user_employee)._init_mashorabot()
        mashorabot = self.env.ref("base.partner_root")
        mashorabot_in_fetch_listeners = self.env['discuss.channel.member'].search([('channel_id', '=', channel.id), ('partner_id', '=', mashorabot.id)])
        self.assertEqual(len(mashorabot_in_fetch_listeners), 1, 'mashorabot should appear only once in channel_fetch_listeners')

    @mute_logger('mashora.addons.mail.models.mail_mail')
    def test_mashorabot_ping(self):
        kwargs = self.message_post_default_kwargs.copy()
        kwargs.update({'body': self.mashorabot_ping_body, 'partner_ids': [self.mashorabot.id, self.user_admin.partner_id.id]})

        with patch('random.choice', lambda x: x[0]):
            self.assertNextMessage(
                self.test_record_employe.with_context({'mail_post_autofollow': True}).message_post(**kwargs),
                sender=self.mashorabot,
                answer=False
            )
        # Mashorabot should not be a follower but user_employee and user_admin should
        follower = self.test_record.message_follower_ids.mapped('partner_id')
        self.assertNotIn(self.mashorabot, follower)
        self.assertIn(self.user_employee.partner_id, follower)
        self.assertIn(self.user_admin.partner_id, follower)

    @mute_logger('mashora.addons.mail.models.mail_mail')
    def test_onboarding_flow(self):
        kwargs = self.message_post_default_kwargs.copy()
        channel = self.user_employee.with_user(self.user_employee)._init_mashorabot()

        kwargs['body'] = 'tagada 😊'
        last_message = self.assertNextMessage(
            channel.message_post(**kwargs),
            sender=self.mashorabot,
            answer=("help",)
        )
        channel.execute_command_help()
        self.assertNextMessage(
            last_message,  # no message will be post with command help, use last mashorabot message instead
            sender=self.mashorabot,
            answer=("@MashoraBot",)
        )
        kwargs['body'] = ''
        kwargs['partner_ids'] = [self.env['ir.model.data']._xmlid_to_res_id("base.partner_root")]
        self.assertNextMessage(
            channel.message_post(**kwargs),
            sender=self.mashorabot,
            answer=("attachment",)
        )
        kwargs['body'] = ''
        attachment = self.env['ir.attachment'].with_user(self.user_employee).create({
            'datas': 'bWlncmF0aW9uIHRlc3Q=',
            'name': 'picture_of_your_dog.doc',
            'res_model': 'mail.compose.message',
        })
        kwargs['attachment_ids'] = [attachment.id]
        # For the end of the flow, we only test that the state changed, but not to which
        # one since it depends on the intalled apps, which can add more steps (like livechat)
        channel.message_post(**kwargs)
        self.assertNotEqual(self.user_employee.mashorabot_state, 'onboarding_attachement')

        # Test miscellaneous messages
        self.user_employee.mashorabot_state = "idle"
        kwargs['partner_ids'] = []
        kwargs['body'] = "I love you"
        self.assertNextMessage(
            channel.message_post(**kwargs),
            sender=self.mashorabot,
            answer=("too human for me",)
        )
        kwargs['body'] = "Go fuck yourself"
        self.assertNextMessage(
            channel.message_post(**kwargs),
            sender=self.mashorabot,
            answer=("I have feelings",)
        )
        kwargs['body'] = "help me"
        self.assertNextMessage(
            channel.message_post(**kwargs),
            sender=self.mashorabot,
            answer=("If you need help",)
        )

    @mute_logger('mashora.addons.mail.models.mail_mail')
    def test_mashorabot_no_default_answer(self):
        kwargs = self.message_post_default_kwargs.copy()
        kwargs.update({'body': "I'm not talking to @mashorabot right now", 'partner_ids': []})
        self.assertNextMessage(
            self.test_record_employe.message_post(**kwargs),
            answer=False
        )

    def assertNextMessage(self, message, answer=None, sender=None):
        last_message = self.env['mail.message'].search([('id', '=', message.id + 1)])
        if last_message:
            body = last_message.body.replace('<p>', '').replace('</p>', '')
        else:
            self.assertFalse(answer, "No last message found when an answer was expect")
        if answer is not None:
            if answer and not last_message:
                self.assertTrue(False, "No last message found")
            if isinstance(answer, list):
                self.assertIn(body, answer)
            elif isinstance(answer, tuple):
                for elem in answer:
                    self.assertIn(elem, body)
            elif not answer:
                self.assertFalse(last_message, "No answer should have been post")
                return
            else:
                self.assertEqual(body, answer)
        if sender:
            self.assertEqual(sender, last_message.author_id)
        return last_message
