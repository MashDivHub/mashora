# -*- coding: utf-8 -*-
# Part of Mashora. See LICENSE file for full copyright and licensing details.


from mashora.addons.website_slides.tests.common import SlidesCase
from mashora.exceptions import ValidationError
from mashora.tests.common import users


class TestSurvey(SlidesCase):
    def setUp(self):
        super(TestSurvey, self).setUp()

        self.survey = self.env['survey.survey'].create({'title': 'TestSurvey', 'certification': True})
        self.survey2 = self.env['survey.survey'].create({'title': 'TestSurvey', 'certification': True})

    @users('user_manager')
    def test_unlink(self):
        [certification, _dummy] = self.env['slide.slide'].create([{
            'name': 'Certification',
            'slide_type': 'certification',
            'channel_id': self.channel.id,
            'survey_id': self.survey.id,
        }, {
            'name': 'Second Certification',
            'slide_type': 'certification',
            'channel_id': self.channel.id,
            'survey_id': self.survey2.id,
        }])

        with self.assertRaises(
            ValidationError,
            msg="Should raise when trying to unlink a survey linked to courses"
        ):
            (self.survey | self.survey2).unlink()

        self.assertTrue(self.survey.exists())
        self.assertTrue(self.survey2.exists())
        certification.survey_id = self.survey2
        self.survey.unlink()
        self.assertFalse(self.survey.exists())
