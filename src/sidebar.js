/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
 *
 * GNOME Maps is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * GNOME Maps is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Champlain = imports.gi.Champlain;
const GtkClutter = imports.gi.GtkClutter;
const Gd = imports.gi.Gd;
const MapView = imports.mapView;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Utils = imports.utils;
const _ = imports.gettext.gettext;

const Sidebar = new Lang.Class({
    Name: 'Sidebar',

    _init: function() {
        this._ui = Utils.getUIObject('sidebar', ['sidebar',
                                                 'instructions-list',
                                                 'revealer',
                                                 'reveal-button']);
        this._ui.revealButton.connect('clicked', this.toggle.bind(this));
        this._ui.revealer.show_all();
        this._ui.instructionsList.connect('row-activated', (function(box, row) {
            this.emit('click-instruction', row.instruction);
        }).bind(this));
        
        this.actor = this._createActor();
        this.actor.hide();
        this.conceal();
    },

    _createActor: function() {
        let actor = new Clutter.Actor({
            layout_manager: new Clutter.BoxLayout({ spacing: 12 }),
            y_expand: true,
            x_align: Clutter.ActorAlign.END
        });

        let buttonActor = new GtkClutter.Actor({
            contents: this._ui.revealButton,
            x_align: Clutter.ActorAlign.END
        });
        Utils.clearGtkClutterActorBg(buttonActor);

        let revealerActor = new GtkClutter.Actor({
            contents: this._ui.revealer,
            x_align: Clutter.ActorAlign.END,
            x_expand: true,
            y_expand: true
        });

        actor.add_child(buttonActor);
        actor.add_child(revealerActor);

        return actor;
    },

    addInstruction: function(instruction) {
        this._ui.instructionsList.add(new InstructionRow(instruction, {
            visible: true
        }));
    },

    reveal: function() {
        this._ui.revealer.reveal_child = true;
        this._ui.revealButton.symbolic_icon_name = 'go-next-symbolic';
    },

    conceal: function() {
        this._ui.revealer.reveal_child = false;
        this._ui.revealButton.symbolic_icon_name = 'go-previous-symbolic';
    },

    toggle: function() {
        if(this.isRevealed())
            this.conceal();
        else
            this.reveal();
    },

    isRevealed: function() {
        return this._ui.revealer.reveal_child;
    }
});
Signals.addSignalMethods(Sidebar.prototype);

const InstructionRow = new Lang.Class({
    Name: "InstructionRow",
    Extends: Gtk.ListBoxRow,

    _init: function(instruction, props) {
        this.parent();
        
        this.instruction = instruction;

        for(let key in props) 
            this[key] = props[key];
        
        let box = new Gtk.Box({
            visible: true,
            can_focus: false
        });
        box.add(new Gtk.Image({
            stock: "gtk-cdrom",
            visible: true,
            can_focus: false
        }));
        box.add(new Gtk.Label({
            visible: true,
            can_focus: false,
            label: instruction.toString()
        }));
        this.add(box);
    }
});

