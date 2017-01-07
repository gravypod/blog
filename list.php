<?php

	require_once("inc/summarizer.class.php");

	// Seconds * Minutes * Hours
	define("MAX_CACHE_LIFE", 60 * 60 * 1);
	define("CACHE_FILE", "inc/cache/posts.json");
	define("POST_DIR", "posts");

	// If the cache file exists and it isn't too old
	if (file_exists(CACHE_FILE) && (time() - filemtime(CACHE_FILE) <= MAX_CACHE_LIFE))
		die(file_get_contents(CACHE_FILE)); // Read and die from that file

	class Post implements JsonSerializable {
		private $summary;
		private $date;
		private $title;
		private $location;
		private $catagory;

		public function __construct($post_file_name) {
			// Generate our summary
			$summarizer = new Summarizer();

			// Get document corpus
			$contents = file_get_contents($post_file_name);

			// Clean and remove unneeded items
			$contents = preg_replace("/(\[[0-9]+\])/", ' ', $contents); // Removes citations boxes ex: [0]
			$contents = preg_replace("/[^\n\.A-Za-z0-9 ]/", '', $contents); // Non-terminal characters (keeps A-z 0-9 \n and ' ')
			$contents = preg_replace("/[a-zA-Z]*[:\/\/]*[A-Za-z0-9\-_]+\.+[A-Za-z0-9\.\/%&=\?\-_]+/i", "", $contents); // URLs

			// Summarize
			$this->summary = $summarizer->get_summary($contents);

			// Remove unwanted spaces.
			$this->summary = trim(preg_replace('/\s\s+/', ' ', str_replace("\n", " ", $this->summary)));


			// Example file name: 02-02-2002_example_file_name.md
			// basename($name, ".md") => 02-02-2002_example_file_name
			$post_basename = basename($post_file_name, ".md");

			// Extract the date
			// 0-10 = 02-02-2002
			$this->date = strtotime(substr($post_basename, 0, 10));

			// Extract the title
			// 11-end = example_file_name
			$this->title = str_replace("_", " ", substr($post_basename, 11));

			$this->location = $post_file_name;

			$this->catagory = basename(dirname($post_file_name));
		}

		public function jsonSerialize() {
			return array(
				"title" => $this->title,
				"date" => $this->date,
				"summary" => $this->summary,
				"location" => $this->location,
				"catagory" => $this->catagory
			);
		}
	}

	$posts = array();

	foreach (glob(POST_DIR . "/*/*.md") as $post_file_name) {
		$posts[] = new Post($post_file_name);
	}

	// Turn our data into JSON
	$blog_contents = json_encode($posts);

	// Store it into the cache file.
	file_put_contents(CACHE_FILE, $blog_contents);

	// Send back to user
	die($blog_contents);
?>
