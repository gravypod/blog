// Borrowed from http://stackoverflow.com/a/196991/1127064
function make_title(str) {
	return str.replace(/\w\S*/g, function(txt) {
		if (txt.length <= 2)
			return txt;
		return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
	});
}

// Borrowed from http://stackoverflow.com/a/847196/1127064
function make_date(timestamp) {
	var today = new Date(timestamp*1000);
	var dd = today.getDate();
	var mm = today.getMonth()+1;
	var yyyy = today.getFullYear();

	if (dd < 10) {
		dd = '0' + dd;
	}

	if (mm < 10) {
		mm = '0' + mm;
	}

	return dd + "/" + mm + "/" + yyyy.toString().substr(2,2);
}

function compare_post_release_date(post_left, post_right) {
	return post_right.date - post_left.date;
}

function add_post_object(post) {
	var post_display = $("#post-display");

	var row = $('<div class="row">');

	var body = $('<div class="panel-body">');

	var title = $('<h1 class="panel-title">');
	{
		var title_header = $('<h1>');
		title_header.html(make_title(post.title));

		var date = $('<span class="badge pull-right">');

		date.html(make_date(post.date) + (post.catagory ? " " + post.catagory : ""));

		date.appendTo(title);
		title_header.appendTo(title);

		title.appendTo(body);
	}

	var content = $('<div class="well-sm">');
	{
		$.get(post.location, function (text) {
			var converter = new showdown.Converter();
			content.html(converter.makeHtml(text));
		}, "text");
		content.appendTo(body);
	}

	body.appendTo(row);
	row.appendTo(post_display);
}

$(document).ready(function () {
	$.getJSON("list.php", function (post_list) {
		post_list.sort(compare_post_release_date);
		post_list.forEach(add_post_object);
	});
});
