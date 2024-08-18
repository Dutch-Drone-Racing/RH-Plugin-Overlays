'''DDR Overlays Plugin'''

import logging
logger = logging.getLogger(__name__)
#import RHUtils
import json

from RHUI import UIField, UIFieldType, UIFieldSelectOption

import requests
from flask import templating
from flask.blueprints import Blueprint

# Read the JSON file
with open('plugins/ddr_overlays/static/data/countries.json', 'r') as file:
    countries_data = json.load(file)
options = []
for country in countries_data:
    code = country["alpha2"]
    name = country["name"]
    option = UIFieldSelectOption(code, name)
    options.append(option)
options.sort(key=lambda x: x.label)
country_ui_field = UIField('country', "Country Code", UIFieldType.SELECT, options=options, value="")

def initialize(rhapi):
    rhapi.fields.register_pilot_attribute( country_ui_field )

    bp = Blueprint(
        'ddr_overlays',
        __name__,
        template_folder='pages',
        static_folder='static',
        static_url_path='/ddr_overlays/static'
    )

    @bp.route('/ddr_overlays')
    def ddr_overlays_homePage():
        return templating.render_template('ddr_overlay_index.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__)

    @bp.route('/ddr_overlays/stream/bar')
    def ddr_overlays_streamBar():
        return templating.render_template('stream/bar.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False)

    @bp.route('/ddr_overlays/stream/next_up')
    def ddr_overlays_streamNextUp():
        return templating.render_template('stream/next_up.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
            num_nodes=8
        )

    @bp.route('/ddr_overlays/stream/node/<int:node_id>')
    def ddr_overlays_streamNode(node_id):
        if node_id <= 8:
            return templating.render_template('stream/node.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
                node_id=node_id-1
            )
        else:
            return False

    @bp.route('/ddr_overlays/stream/leaderboard/<int:class_id>')
    def ddr_overlays_streamLeaderboard32(class_id):
        return templating.render_template('stream/leaderboard_32.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
            class_id=class_id
        )

    @bp.route('/ddr_overlays/stream/leaderboard_pages/<int:class_id>')
    def ddr_overlays_streamLeaderboard32Pages(class_id):
        return templating.render_template('stream/leaderboard_32_pages.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
            class_id=class_id
        )

    @bp.route('/ddr_overlays/stream/brackets/<string:bracket_type>/<int:numb_pilots>/<string:class_title>')
    def ddr_overlays_streamBrackets(bracket_type, numb_pilots, class_title):
        return templating.render_template('stream/brackets.html', serverInfo=None, getOption=rhapi.db.option,__=rhapi.__,
            bracket_type=bracket_type, numb_pilots=numb_pilots, class_title=class_title
        )

    @bp.route('/ddr_overlays/stream/last_heat/<int:numb_pilots>')
    def ddr_overlays_streamLastHeat(numb_pilots):
        return templating.render_template('stream/last_heat.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
            numb_pilots=numb_pilots
        )

    rhapi.ui.blueprint_add(bp)

    leaderboard_markdown = 'abc def'

    rhapi.ui.register_markdown(
        'ddr_overlays',
        'DDR Overlays',
        leaderboard_markdown
    )
