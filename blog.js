function clean_url_title(title) {
	return encodeURIComponent(title.replace(new RegExp(' ', 'g'), "_"));
}

// Borrowed from http://stackoverflow.com/a/196991/1127064
function make_title(str) {
	return str.replace(/\w\S*/g, function(txt, offset, string) {
		if (txt.length <= 2 && offset > 0)
			return txt;
		return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
	});
}

// Borrowed from http://stackoverflow.com/a/847196/1127064
function make_date(timestamp) {
	var today = new Date(timestamp * 1000);
	var dd = today.getDate();
	var mm = today.getMonth() + 1;
	var yyyy = today.getFullYear();

	dd = dd < 10 ? '0' + dd : dd;
	mm = mm < 10 ? '0' + mm : mm;

	return dd + "/" + mm + "/" + yyyy.toString().substr(2, 2);
}

function compare_post_release_date(post_left, post_right) {
	return post_right.date - post_left.date;
}

function add_post_object(post) {
	var post_display = $("#blog-body");

	var body = $('<div class="item post">');

	var title = $('<div>');
	{
		var title_header = $(`<a href="./?title=${clean_url_title(post.title)}" class="post-title">`);
		title_header.html(make_title(post.title));

		var date = $('<div class="post-time">'); // $('<span class="badge pull-right">');

		date.html('(' + make_date(post.date) + (post.catagory ? " " + post.catagory : "") + ')');

		title_header.appendTo(title);
		date.appendTo(title);

		title.appendTo(body);
	}

	var content = $('<div>');
	{
		$.get(post.location, function (text) {
			var converter = new showdown.Converter();
			content.html(converter.makeHtml(text));
		}, "text");
		content.appendTo(body);
	}

	body.appendTo(post_display);
	$('<hr>').appendTo(post_display);
}

// Get variable parse https://stackoverflow.com/a/21210643/1127064
var queryDict = {}
location.search.substr(1).split("&").forEach(function(item) {queryDict[item.split("=")[0]] = item.split("=")[1]})

$(document).ready(function () {
	showdown.setOption("tables", true);
	$.getJSON("posts-cached.json", function (post_list) {
		post_list.sort(compare_post_release_date);
		if (queryDict.title !== undefined) {
			post_list = post_list.filter(function (p) { return clean_url_title(p.title) == queryDict.title; });
		}
		post_list.forEach(add_post_object);
	});
});

