var myapp = (function () {

    var cfg = {
        id: {
            file: "#file",
            file_browse_button: "#file-browse-button",
            file_drop_zone: "#file-drop-zone",

            toolbar: "#toolbar",
            icon_size: "#wi-icon-size",
            tab1_content: "#tab1-content",
            tab2_content: "#tab2-content",
            select_glyphs: "#select-glyphs",

            form_charset: "#form-charset",
            rearrange_glyphs: "#rearrange-glyphs",

            font: "#font",
            icon_assignments: "#icon-assignments"
        },
        template: {
            upload_status: { id: "#tpl-upload-status" },
            icon_size_button: { id: "#tpl-icon-size-button" },
            glyph: { id: "#tpl-glyph" },
            glyph_group: { id: "#tpl-glyph-group" },
            glyph_group_separator: { id: "#tpl-glyph-group-separator" },
            rearrange_glyph: { id: "#tpl-rearrange-glyph" }
        },
        preview_icon_sizes: [64, 48, 32, 24, 16],
        live_update: true,
        basic_latin: {
            str: "",
            begin: 33,
            end: 126,
            extra: " ",
        },
        unicode_private: {
            begin: 0xf0000,
            end: 0xf005e
        },
        draggable_options: {
            revert: "invalid",
            cursor: "move",
            helper: "clone",
            opacity: 0.5,
            disabled: false
        },
        path_options: {
            fill: "#000",
            stroke: "#000",
            transform: "S1 -1"      // svg font's y axis goes upward
        }
    };
    var myfiles = [];
    var myglyphs = [];
    var xml_template = null;
    var g_id = 0;   // next glyph id

    var init = function () {
        // init cfg.basic_latin.str
        cfg.basic_latin.str = "";
        for (var i=cfg.basic_latin.begin; i<=cfg.basic_latin.end; i++)
            cfg.basic_latin.str += String.fromCharCode(i);
        cfg.basic_latin.str += cfg.basic_latin.extra;

        // init templates
        for (var key in cfg.template) {
            cfg.template[key].tpl = $(cfg.template[key].id).clone().removeAttr("id");
            $(cfg.template[key].id).remove();
        }

        // init file upload form
        $(cfg.id.file).change(function (event) {
            appendFiles(event.target.files, function (fileinfo) {
                addGlyphGroup(fileinfo);
            });
        });
        $(cfg.id.file_browse_button).click(function (event) {
  	        event.preventDefault();
            $(cfg.id.file).click();
        });

        // init file drag and drop
        $(cfg.id.file_drop_zone).on("dragover", function (event) {
	        event.stopPropagation();
	        event.preventDefault();
	        event.originalEvent.dataTransfer.dropEffect = 'copy';
        });
        $(cfg.id.file_drop_zone).on("drop", function (event) {
	        event.stopPropagation();
	        event.preventDefault();
            appendFiles(event.originalEvent.dataTransfer.files, function (fileinfo) {
                addGlyphGroup(fileinfo);
            });
        });

        // init preview icon size selection
        for (var i=0, len=cfg.preview_icon_sizes.length; i<len; i++) {
            var tpl = $(cfg.template.icon_size_button.tpl).clone();
            tpl.toggleClass("active", i == 0);
            tpl.text(cfg.preview_icon_sizes[i]);
            tpl.click(function (event) {
                event.preventDefault();
                var size = $(this).text() + "px";
                console.log('size='+size);
                $(cfg.id.tab1_content)
                    .find(".gd").css({
                        width: size, height: size, "font-size": size})
                    .find("svg").css({width: size, height: size});
            });
            $(cfg.id.icon_size).append(tpl);
        }

        $("#tab").tab("show");
        // activate first tab
        $("#tab a:first").tab("show");

        // init charset selection
        $(cfg.id.form_charset).find("input.wi-charset").change(function () {
            var charset = $(this).val();
            var content = $(cfg.id.tab2_content);
            if (charset == "basic_latin") {
                content.find("div.rg-top").each(function (index) {
                    // FIXME
                    if (cfg.basic_latin.str[index] == " ")
                        $(this).text("space");
                    else
                        $(this).text(cfg.basic_latin.str[index]);
                });
                content.find("div.rg-bottom").each(function (index) {
                    $(this).text(toUnicode(cfg.basic_latin.str[index]));
                });
                content.find("input.wi-unicode").each(function (index) {
                    $(this).val(cfg.basic_latin.str[index]);
                });
            } else {
                // FIXME
                content.find("div.rg-top").each(function (index) {
                    var c = (cfg.unicode_private.begin+index)
                        .toString(16).toUpperCase();
                    $(this).text("&#x"+c+";");
                });
                content.find("div.rg-bottom").each(function (index) {
                    var c = (cfg.unicode_private.begin+index)
                        .toString(16).toUpperCase();
                    $(this).text("U+"+c);
                });
                content.find("input.wi-unicode").each(function (index) {
                    var c = (cfg.unicode_private.begin+index)
                        .toString(16).toUpperCase();
                    $(this).val("&#x"+c+";");
                });
            }

            if (cfg.live_update) {
                updateFont();
                updateIconAssignments();
            }
        });
       
        // init drag and drop for rearrange icons
        for (var i=0, len=cfg.basic_latin.str.length; i<len; i++) {
            var tpl = $(cfg.template.rearrange_glyph.tpl).clone();

            var char = cfg.basic_latin.str[i];
            tpl.attr("id", "rgl"+i);
            tpl.find(".wi-unicode").attr("id", "rgu"+i).val(toCharRef(char));
            tpl.find(".rg-top").text(char != " " ? char : "space");
            tpl.find(".rg-bottom").text(toUnicode(char));
            tpl.find(".rg-icon").attr("id", "rgd"+i);
            tpl.find(".rg-icon").droppable({
                drop: function (event, ui) {
                    console.log("drop");
                    var draggable=ui.draggable;
                    var g_id=$(this).siblings("input:checkbox").attr("value");
                    var d=$(this).contents();

                    $(this).siblings("input:checkbox").attr({value: draggable.siblings("input:checkbox").attr("value")});
                    $(this).empty().append(draggable.contents());

                    draggable.siblings("input:checkbox").attr({value: g_id});
                    draggable.empty().append(d);

                    if (!$(this).parent().hasClass("selected")) {
                        $(this).parent().addClass("selected");
                        draggable.parent().removeClass("selected");
                        $(this).draggable(cfg.draggable_options);
                        draggable.draggable("disable");
                        $(this).siblings("input:checkbox").attr({checked: true});
                       draggable.siblings("input:checkbox").attr({checked: false});
                    }

                    if (cfg.live_update) {
                        updateFont();
                        updateIconAssignments();
                    }
                }
            });
            $(cfg.id.tab2_content).append(tpl);
        }

        // init "select all"
        $("a.select-all").click(function (event) {
            $($(this).attr("href")).select();
            event.preventDefault();
        });
    };

    var appendFiles = function (files, cb_onload) {
        for (var i=0, f; f=files[i]; i++) {
            var idx = myfiles.push({
                id: null,
                filename: f.name,
                filesize: f.size, 
                filetype: f.type,
                fontname: "unknown",
                is_loaded: 0,
                is_dup: 0,
                is_invalid: 0,
                content: null
            }) - 1;
            myfiles[idx].id = idx;

            var reader = new FileReader();
            reader.onload = (function (fileinfo) {
                return function (e) {
                    // FIXME: race condition?
                    // is there a file with the same content?
                    var is_exist = 0;
                    for (var i=0, len=myfiles.length; i<len; i++) {
                        if (!myfiles[i])
                            continue;
                        if (myfiles[i].content == e.target.result) {
                            fileinfo.is_dup = is_exist = 1;
                            break;
                        }
                    }
                    if (!is_exist) {
                        fileinfo.content = e.target.result;
                        fileinfo.is_loaded = 1;
                    }

                    if (cb_onload)
                        cb_onload(fileinfo);
                };
            })(myfiles[idx]);
            reader.readAsBinaryString(f);
        }
    };

/*
    var updateFilesList = function () {
        var output = [];
	    for (var i=0, f; f = myfiles[i]; i++) {
            var tr = cfg.template.upload_status.tpl.clone();
            var row = [
                f.name,
                f.size,
                f.is_invalid ? "invalid" :
                    f.is_dup ? "duplicate, skipped" : 
                    f.is_loaded ? "loaded" : "loading..."
            ];
            tr.find("td").each(function (index) {
                $this = $(this);
                $this.text(row[index]);
            });
            output.push(tr.html());
	    }
        $(cfg.template.upload_status.id).empty().append(output.join(""));
    };
*/

    var addGlyphGroup = function (fileinfo) {
        console.log("addGlyphGroup id=", fileinfo.id);
        var div = cfg.id.select_glyphs;

        // if it is a dup, skip it
        if (fileinfo.is_dup)
            return;

        var xml = null;
        try {
            xml = $.parseXML(fileinfo.content);
        } catch (e) {
            console.log("invalid xml");
            fileinfo.is_invalid = 1;
            return;
        }

        //FIXME
        if (!xml_template)
            xml_template = makeXmlTemplate($.parseXML(fileinfo.content));

        // FIXME
        $(cfg.id.tab1_content).find(".wi-glyph-id").off("click");

        var horiz_adv_x = $("font:first", xml).attr("horiz-adv-x") || 1000;
        var ascent = $("font-face:first", xml).attr("ascent") || 750;
        var descent = $("font-face:first", xml).attr("descent") || -250;
        fileinfo.fontname = $("font:first", xml).attr("id") || "unknown";

        var size = $(cfg.id.icon_size).find("button.active").text();
        var sizepx = size + "px";

        // add a separator
        var tpl_sep = $(cfg.template.glyph_group_separator.tpl).clone()
            .attr("id", "wi-font-sep-"+fileinfo.id);
        tpl_sep.find(".wi-font-name").text(fileinfo.fontname).attr("href", "#font-"+fileinfo.id);
        tpl_sep.find(".wi-close-group").click(function (event) {
            removeGlyphGroup(fileinfo);
        });
        $(cfg.id.tab1_content).append(tpl_sep);

        // add a glyph-group
        var tpl_gg = $(cfg.template.glyph_group.tpl).clone()
            .attr("id", "wi-font-glyphs-"+fileinfo.id);
        $(cfg.id.tab1_content).append(tpl_gg);

        // add glyphs to the glyph group
        $("glyph", xml).filter(function (i) {
            //return i < 10;  // for testing
            return true;
        }).each(function () {
            var tpl = $(cfg.template.glyph.tpl).clone();
            tpl.find(".wi-glyph-id").val(g_id);
            tpl.find(".gd")
                .attr("id", "gd"+g_id)
                .css({
                    width: sizepx,
                    height: sizepx,
                    "font-size": sizepx
                });
            $(tpl_gg).append(tpl);

            // add svg 
            var r = Raphael("gd"+g_id, size, size);
            r.setViewBox(0, descent, horiz_adv_x, ascent-descent, true);
            var g = r.path($(this).attr("d")).attr(cfg.path_options);
            g.show();

            myglyphs[g_id] = { dom_node: this, file_id: fileinfo.id };
            g_id++;
        });

        $(cfg.id.tab1_content).find(".wi-glyph-id").click(function (event) {
            $(this).parent().toggleClass("selected", $(this).is(":checked"));
            toggleGlyph($(this).attr("value"), $(this).is(":checked"));

            if (cfg.live_update) {
                updateFont();
                updateIconAssignments();
            }
        });

        // scroll to the loaded font
/*
        var fonthash = 'a[href="#font-'+fileinfo.id+'"]';
        $("html,body").animate({scrollTop: $(fonthash).offset().top}, 500);
*/
    };

    var removeGlyphGroup = function (fileinfo) {
        console.log("removeGlyphGroup id=", fileinfo.id);

        var file_id = fileinfo.id;

        // free mem
        for (var i=0, len=myglyphs.length; i<len; i++) {
            if (myglyphs[i].file_id == file_id) {
                myglyphs[i].dom_node = null;
                myglyphs[i].file_id = -1;   // null?
            }
        }
        myfiles[file_id] = null;

        // remove associated html mark up
        var sep = $(cfg.id.tab1_content).find('#wi-font-sep-'+file_id);
        var glyphs = $(cfg.id.tab1_content).find('#wi-font-glyphs-'+file_id);
        glyphs.find("input:checkbox:checked").each(function() {
            var glyph_id = $(this).val();
            removeGlyph(glyph_id);
        });
        glyphs.remove();
        sep.remove();
    };

    var toggleGlyph = function (g_id, is_checked) {
        if (is_checked)
            addGlyph(g_id);
        else
            removeGlyph(g_id);
    };

    // add a glyph to the rearrange zone
    var addGlyph = function (g_id) {
        console.log("addGlyph g_id=", g_id);
        var checkbox=$(cfg.id.tab2_content).find(".wi-glyph-id:not(:checked):first");
        checkbox.attr({value: g_id, checked: true});
        checkbox.parent().addClass("selected");
        $("#gd"+g_id).contents().clone(false).css({width: "", height: ""}).appendTo(checkbox.siblings(".rg-icon"));
        checkbox.siblings(".rg-icon").draggable(cfg.draggable_options)
    };

    // remove a glyph from the rearrange zone
    var removeGlyph = function (g_id) {
        console.log("removeGlyph g_id=", g_id);
        var checkbox=$(cfg.id.tab2_content).find(".wi-glyph-id:checked[value='"+g_id+"']");
        checkbox.attr({value: "", checked: false});
        checkbox.parent().removeClass("selected");
        checkbox.siblings(".rg-icon").empty();
    };

    var makeXmlTemplate = function (xml) {
        $("glyph", xml).remove();
        return xml;
    };

    // update font's textarea
    var updateFont = function () {
        if (!xml_template)
            return;

        var glyphs = [];
        $(cfg.id.tab2_content)
            .find("input:checkbox:checked")
            .each(function () {
                var $this = $(this);
                var g_id = $this.val();
                var unicode = $this.siblings("input.wi-unicode").val();
                if (!myglyphs[g_id]) {
                    console.log("undefined myglyphs[", g_id, "]");
                    return; 
                }
                var g = $(myglyphs[g_id].dom_node);
                g.attr("unicode", unicode);
                glyphs.push(outerHtml(g));
            });
        $("glyph", xml_template).remove();
        $("font", xml_template).append($(glyphs.join("")));
        $(cfg.id.font).text(xmlToString(xml_template));
    };

    // update IA's textarea
    var updateIconAssignments = function () {
        var lines = [];
        lines.push(
            "/*",
            "", 
            "Icon                		Hex entity          CSS content",
            "======================================================================"
        );

        $(cfg.id.tab2_content)
            .find("input:checkbox:checked")
            .each(function () {
                var $this = $(this);
                var g_id = $this.val();
                var unicode = $this.siblings("input.wi-unicode").val();
                var tmp = toEntityAndCss(unicode);
                lines.push(
                    rpad("n/a", 32)
                    +rpad(tmp.entity, 20)
                    +tmp.css
                );
            });
        lines.push("", "*/");
        $(cfg.id.icon_assignments).text(lines.join("\n"));
    }

    // ===============
    // misc functions
    // ===============
    var outerHtml = function (jquery_object) {
        return $("<div/>").append(jquery_object.clone()).html();
    };

    var xmlToString = function(xmlDom) {
        // cross-browser
        var result = (typeof XMLSerializer!=="undefined")
            ? (new window.XMLSerializer()).serializeToString(xmlDom)
            : xmlDom.xml;
        //FIXME: quickfix: get rid of unwanted xmlns insertion
        result = result.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, "");
        //FIXME: quickfix: remove the extra newlines
        result = result.replace(/>(\s)*<glyph/gm, "><glyph");
        //FIXME: quickfix: &amp; => &
        result = result.replace(/&amp;#x/gm, "&#x");
        return result;
    };

    // return char in CharRef notation
    var toCharRef = function (char) {
        return "&#x" + char.charCodeAt(0).toString(16) + ";";
    };

    // return char in U+ notation
    var toUnicode = function (char) {
        var c = char.charCodeAt(0).toString(16).toUpperCase();
        if (c.length < 4)
            c = "0000".substr(0, 4-c.length) + c;
        return "U+" + c;
    };

    //FIXME
    var toEntityAndCss = function (char) {
        var code = char.charCodeAt(0);
        if (32 <= code && code <= 127)
            return {
                entity: char,
                css: "content: '"+char+"';"
            };
        else
            return {
                entity: toCharRef(char),
                css: "content: '\\"+code.toString(16)+"';"
            };  
    };

    // string functions
    var repeat = function (s, times) {
        if (times < 1)
            return "";
        var result = "";
        while (times > 0) {
            if (times & 1)
                result += s;
            times >>= 1;
            s += s;
        }
        return result; 
    };

    var rpad = function (s, len) {
        if (s.length < len)
            return s + repeat(" ", len - s.length);
        else
            return s;
    };

    var lpad = function (s, len) {
        if (s.length < len)
            return repeat(" ", len - s.length) + s;
        else
            return s;
    };

    // public interface
	return {
		init: init
	};
})();

$(document).ready(function () {
    myapp.init();
});
