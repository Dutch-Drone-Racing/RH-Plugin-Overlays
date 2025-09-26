'''DDR Overlays Plugin'''

import os
import json
import logging
import requests
import zipfile

from RHUI import UIField, UIFieldType, UIFieldSelectOption

from flask import jsonify, request, templating
from flask.blueprints import Blueprint

logger = logging.getLogger(__name__)

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

# Folder for pilot images
PILOT_IMAGE_UPLOAD_FOLDER = 'shared/avatars'
os.makedirs(PILOT_IMAGE_UPLOAD_FOLDER, exist_ok=True)

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
def allowed_image(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

def initialize(rhapi):
    rhapi.fields.register_pilot_attribute( country_ui_field )

    bp = Blueprint(
        'ddr_overlays',
        __name__,
        template_folder='pages',
        static_folder='static',
        static_url_path='/ddr_overlays/static'
    )

    ### home page ###
    @bp.route('/ddr_overlays')
    def ddr_overlays_homePage():
        return templating.render_template('ddr_overlay_index.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__)

    ### live results ###
    @bp.route('/ddr_overlays/stream/results')
    def ddr_overlays_streamResults():
        return templating.render_template('stream/results.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False)

    ### bar ###
    @bp.route('/ddr_overlays/stream/bar')
    def ddr_overlays_streamBar():
        return templating.render_template('stream/bar.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False)

    ### overlays based on bracket type and class ###
    @bp.route('/ddr_overlays/stream/leaderboard/<string:bracket_type>/<int:class_id>')
    def ddr_overlays_streamLeaderboard(bracket_type, class_id):
        return templating.render_template('stream/leaderboard.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
            bracket_type=bracket_type, class_id=class_id
        )

    @bp.route('/ddr_overlays/stream/leaderboard_pages/<string:bracket_type>/<int:class_id>')
    def ddr_overlays_streamLeaderboardPages(bracket_type, class_id):
        return templating.render_template('stream/leaderboard_pages.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
            bracket_type=bracket_type, class_id=class_id
        )

    @bp.route('/ddr_overlays/stream/brackets/<string:bracket_type>/<int:class_id>')
    def ddr_overlays_streamBrackets(bracket_type, class_id):
        return templating.render_template('stream/brackets.html', serverInfo=None, getOption=rhapi.db.option,__=rhapi.__, DEBUG=False,
            bracket_type=bracket_type, class_id=class_id
        )

    @bp.route('/ddr_overlays/stream/last_heat/<string:bracket_type>/<int:class_id>')
    def ddr_overlays_streamLastHeat(bracket_type, class_id):
        return templating.render_template('stream/last_heat.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
            bracket_type=bracket_type, class_id=class_id
        )

    @bp.route('/ddr_overlays/stream/next_up/<string:bracket_type>/<int:class_id>')
    def ddr_overlays_streamNextUp(bracket_type, class_id):
        return templating.render_template('stream/next_up.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
            bracket_type=bracket_type, class_id=class_id, num_nodes=8
        )

    @bp.route('/ddr_overlays/stream/podium/<string:bracket_type>/<int:class_id>')
    def ddr_overlays_streamPodium(bracket_type, class_id):
        return templating.render_template('stream/podium.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
            bracket_type=bracket_type, class_id=class_id
        )
    ################################################

    ### node ###
    @bp.route('/ddr_overlays/stream/node/<int:node_id>')
    def ddr_overlays_streamNode(node_id):
        if node_id <= 8:
            return templating.render_template('stream/node.html', serverInfo=None, getOption=rhapi.db.option, __=rhapi.__, DEBUG=False,
                node_id=node_id-1
            )
        else:
            return False

    ################################################

    ### upload pilot image ###
    @bp.route("/upload_pilot_image", methods=["POST"])
    def upload_pilot_image():
        if "file" not in request.files:
            return jsonify({"error": "no file"}), 400

        file = request.files["file"]
        pilot_id = request.form.get("pilot_id", "unknown")

        if file.filename == "":
            return jsonify({"error": "empty filename"}), 400

        if not allowed_image(file.filename):
            return jsonify({"error": "invalid extension"}), 400

        # size check
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > 10 * 1024 * 1024:
            return jsonify({"error": "file too big (more than 10 MB)"}), 400

        filename = file.filename
        filepath = os.path.join(PILOT_IMAGE_UPLOAD_FOLDER, filename)
        file.seek(0)
        file.save(filepath)

        # public URL to get the image
        file_url = filepath

        return jsonify({"success": True, "new_url": file_url})

    ### upload pilot image bulk ###
    @bp.route("/upload_zip", methods=["POST"])
    def upload_zip():
        if "zipfile" not in request.files:
            return jsonify({"error": "no file"}), 400

        zip_file = request.files["zipfile"]

        if zip_file.filename == "":
            return jsonify({"error": "empty filename"}), 400

        # size check
        zip_file.seek(0, os.SEEK_END)
        size = zip_file.tell()
        zip_file.seek(0)
        if size > 100 * 1024 * 1024:
            return jsonify({"error": "ZIP file too big (more than 100 MB)"}), 400

        # temporary path
        temp_path = os.path.join(PILOT_IMAGE_UPLOAD_FOLDER, "temp_upload.zip")
        zip_file.save(temp_path)

        # extraction
        try:
            with zipfile.ZipFile(temp_path, 'r') as zip_ref:
                for member in zip_ref.namelist():
                    # avoid path traversal such as "../../"
                    if not os.path.basename(member) == member:
                        os.remove(temp_path)
                        return jsonify({"error": "ZIP file contains subfolders or invalid paths"}), 400

                # extract only valid files
                zip_ref.extractall(PILOT_IMAGE_UPLOAD_FOLDER)
        except zipfile.BadZipFile:
            os.remove(temp_path)
            return jsonify({"error": "file is not a valid ZIP"}), 400

        # remove the temporary archive
        os.remove(temp_path)

        return jsonify({"success": True, "message": "ZIP uploaded successfully"})

    rhapi.ui.blueprint_add(bp)

    rhapi.ui.register_panel("ddr_overlays", "DDR - OBS Overlays", "settings")
    rhapi.ui.register_markdown("ddr_overlays", "DDR Overlays link", "Overlays are available [here](/ddr_overlays)")
